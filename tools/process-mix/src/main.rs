use serde::Deserialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use tempfile::TempDir;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobFile {
    audio_path: String,
    image_path: String,
    title: String,
    description: String,
    output_format: String,
    output_path: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    intro_audio_path: Option<String>,
}

struct ResolvedJob {
    audio_path: PathBuf,
    image_path: PathBuf,
    intro_audio_path: PathBuf,
    output_path: PathBuf,
    title: String,
    description: String,
    output_format: String,
    artist: Option<String>,
    album: Option<String>,
}

fn parse_args() -> Result<PathBuf, String> {
    let args: Vec<String> = env::args().collect();
    
    if args.len() == 2 {
        if args[1].starts_with("--job=") {
            return Ok(PathBuf::from(&args[1][6..]));
        }
        return Ok(PathBuf::from(&args[1]));
    }
    
    if args.len() == 3 {
        if args[1] == "--job" || args[1] == "-j" {
            return Ok(PathBuf::from(&args[2]));
        }
    }
    
    Err("Usage: process-mix [--job|-j] <path-to-job.json>".to_string())
}

fn read_job_file(path: &Path) -> Result<JobFile, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read job file: {}", e))?;
    
    let job: JobFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse job JSON: {}", e))?;
    
    if job.audio_path.is_empty() {
        return Err("audioPath is required".to_string());
    }
    if job.image_path.is_empty() {
        return Err("imagePath is required".to_string());
    }
    if job.title.is_empty() {
        return Err("title is required".to_string());
    }
    if job.description.is_empty() {
        return Err("description is required".to_string());
    }
    if job.output_format != "mp3" && job.output_format != "mp4" {
        return Err("outputFormat must be 'mp3' or 'mp4'".to_string());
    }
    
    Ok(job)
}

fn to_safe_mix_title(title: &str) -> String {
    title
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '_' })
        .collect()
}

fn resolve_job_paths(job: JobFile, job_path: &Path) -> Result<ResolvedJob, String> {
    let job_dir = job_path.parent().unwrap_or(Path::new("."));
    
    let audio_path = job_dir.join(&job.audio_path);
    let image_path = job_dir.join(&job.image_path);
    
    let intro_audio_path = if let Some(intro) = job.intro_audio_path {
        job_dir.join(intro)
    } else {
        let exe_path = env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        let bin_dir = exe_path.parent().unwrap_or(Path::new("."));
        bin_dir.join("intro.wav")
    };
    
    let output_path = if let Some(output) = job.output_path {
        job_dir.join(output)
    } else {
        let safe_title = to_safe_mix_title(&job.title);
        job_dir.join(format!("{}.{}", safe_title, job.output_format))
    };
    
    Ok(ResolvedJob {
        audio_path,
        image_path,
        intro_audio_path,
        output_path,
        title: job.title,
        description: job.description,
        output_format: job.output_format,
        artist: job.artist,
        album: job.album,
    })
}

fn format_tracklist(description: &str) -> String {
    description
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with('#')
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_ffmpeg_args(
    temp_dir: &Path,
    job: &ResolvedJob,
    output_format: &str,
) -> Vec<String> {
    let audio_path = temp_dir.join("audio.mp3");
    let image_path = temp_dir.join("cover.jpg");
    let output_path = temp_dir.join(format!("output.{}", output_format));
    
    let mut args = Vec::new();
    
    if output_format == "mp3" {
        args.extend([
            "-i".to_string(), audio_path.to_string_lossy().to_string(),
            "-i".to_string(), job.intro_audio_path.to_string_lossy().to_string(),
            "-i".to_string(), image_path.to_string_lossy().to_string(),
            "-filter_complex".to_string(),
            "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]".to_string(),
            "-c:a".to_string(), "libmp3lame".to_string(),
            "-b:a".to_string(), "320k".to_string(),
            "-map".to_string(), "[a]".to_string(),
            "-map".to_string(), "2".to_string(),
            "-c:v".to_string(), "mjpeg".to_string(),
            "-disposition:v:0".to_string(), "attached_pic".to_string(),
            "-metadata".to_string(), "TCON=Electronic".to_string(),
        ]);
        
        if let Some(artist) = &job.artist {
            args.extend(["-metadata".to_string(), format!("artist={}", artist)]);
        }
        
        let album = job.album.as_deref().unwrap_or("GBFM");
        args.extend(["-metadata".to_string(), format!("album={}", album)]);
        
        let tracklist = format_tracklist(&job.description);
        let tracklist_text = format!("Tracklist:\n{}", tracklist);
        
        args.extend([
            "-metadata".to_string(), format!("description={}", tracklist_text),
            "-metadata".to_string(), format!("comment={}", tracklist_text),
            "-metadata".to_string(), format!("lyrics={}", tracklist_text),
            "-metadata".to_string(), format!("USLT={}", tracklist_text),
            "-id3v2_version".to_string(), "3".to_string(),
        ]);
    } else {
        args.extend([
            "-loop".to_string(), "1".to_string(),
            "-i".to_string(), image_path.to_string_lossy().to_string(),
            "-i".to_string(), audio_path.to_string_lossy().to_string(),
            "-i".to_string(), job.intro_audio_path.to_string_lossy().to_string(),
            "-filter_complex".to_string(),
            "[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[a]".to_string(),
            "-c:v".to_string(), "libx264".to_string(),
            "-tune".to_string(), "stillimage".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-shortest".to_string(),
            "-vf".to_string(),
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2".to_string(),
            "-map".to_string(), "0:v".to_string(),
            "-map".to_string(), "[a]".to_string(),
        ]);
    }
    
    args.push(output_path.to_string_lossy().to_string());
    args
}

fn process_mix(job: ResolvedJob) -> Result<PathBuf, String> {
    let audio_data = fs::read(&job.audio_path)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;
    let image_data = fs::read(&job.image_path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;
    
    let temp_dir = TempDir::new()
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    let temp_audio = temp_dir.path().join("audio.mp3");
    let temp_image = temp_dir.path().join("cover.jpg");
    
    fs::write(&temp_audio, &audio_data)
        .map_err(|e| format!("Failed to write temp audio: {}", e))?;
    fs::write(&temp_image, &image_data)
        .map_err(|e| format!("Failed to write temp image: {}", e))?;
    
    let ffmpeg_args = build_ffmpeg_args(temp_dir.path(), &job, &job.output_format);
    
    let output = Command::new("ffmpeg")
        .args(&ffmpeg_args)
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }
    
    if !output.stderr.is_empty() {
        eprintln!("{}", String::from_utf8_lossy(&output.stderr));
    }
    
    let temp_output = temp_dir.path().join(format!("output.{}", job.output_format));
    let output_data = fs::read(&temp_output)
        .map_err(|e| format!("Failed to read output file: {}", e))?;
    
    if let Some(parent) = job.output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }
    
    fs::write(&job.output_path, &output_data)
        .map_err(|e| format!("Failed to write output file: {}", e))?;
    
    Ok(job.output_path)
}

fn main() -> ExitCode {
    let job_path = match parse_args() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("{}", e);
            return ExitCode::from(1);
        }
    };
    
    let job = match read_job_file(&job_path) {
        Ok(job) => job,
        Err(e) => {
            eprintln!("{}", e);
            return ExitCode::from(1);
        }
    };
    
    let resolved = match resolve_job_paths(job, &job_path) {
        Ok(job) => job,
        Err(e) => {
            eprintln!("{}", e);
            return ExitCode::from(1);
        }
    };
    
    match process_mix(resolved) {
        Ok(output_path) => {
            println!("{}", output_path.display());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{}", e);
            ExitCode::from(1)
        }
    }
}
