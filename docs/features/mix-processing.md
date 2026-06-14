# Mix Processing

Local CLI pipeline that takes a job JSON file, reads a raw audio file plus cover image, runs FFmpeg to embed metadata and artwork for MP3 or produce a video with a still image for MP4, then writes the result to disk.

## CLI

Requires `ffmpeg` in PATH.

Build and run the Rust binary:

```bash
cargo build --release --manifest-path tools/process-mix/Cargo.toml
./tools/process-mix/target/release/process-mix --job <path-to-job.json>
./tools/process-mix/target/release/process-mix <path-to-job.json>
```

Job file fields:

| Field | Type | Required |
|---|---|---|
| `audioPath` | path | yes |
| `imagePath` | path | yes |
| `title` | string | yes |
| `description` | string | yes |
| `outputFormat` | `mp3` \| `mp4` | yes |
| `outputPath` | path | no |
| `artist` | string | no |
| `album` | string | no |
| `introAudioPath` | path | no |

All paths inside the job file are resolved relative to the job file itself.

Example:

```json
{
  "audioPath": "./input/mix.wav",
  "imagePath": "./input/cover.jpg",
  "title": "Late Night Transmission",
  "description": "01. Artist - Track\n02. Artist - Track",
  "outputFormat": "mp3",
  "outputPath": "./output/late-night-transmission.mp3",
  "artist": "GBFM",
  "album": "GBFM",
  "introAudioPath": "./input/intro.wav"
}
```

Prints the output file path to stdout on success.

## Architecture

```
job json
  → process-mix (Rust binary)
    → tools/process-mix/src/main.rs
      → parse_args
      → read_job_file
      → resolve_job_paths
      → process_mix
        → read audio + image files
        → write to tempdir (audio.mp3, cover.jpg)
        → build_ffmpeg_args (MP3 or MP4)
        → Command::new("ffmpeg").args(...)
        → read output buffer
        → write final output to requested path
        → tempdir auto-cleanup (TempDir drop)
```

## Temp File Cleanup

`process_mix` uses `tempfile::TempDir` which automatically removes the temp directory when dropped, whether FFmpeg succeeds or fails. The only unhandled case is an OS-level kill mid-FFmpeg, where `/tmp/.tmp*` files persist until the OS clears `/tmp`.

## Known Limitations

- Each invocation processes one job file.
- Running many jobs in parallel can still exhaust memory or file descriptors.

## Gotchas

### Output path default

If `outputPath` is omitted, the CLI writes to `<safe_title>.<format>` next to the job file.

### Default intro audio

If `introAudioPath` is omitted, the CLI uses `intro.wav` from the same directory as the binary (e.g., `tools/process-mix/target/release/intro.wav` after building).
