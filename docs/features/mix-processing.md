# Mix Processing

Local CLI pipeline that takes a job JSON file, reads a raw audio file plus cover image, runs FFmpeg to embed metadata and artwork for MP3 or produce a video with a still image for MP4, then writes the result to disk.

Recommended local layout:

```text
tools/process-mix/
  assets/covers/   # shared reusable cover art
  jobs/            # one json file per mix job
  output/          # generated media, ignored by git
```

## CLI

Requires `ffmpeg` in PATH.

Build and run the Rust binary:

```bash
cargo build --release --manifest-path tools/process-mix/Cargo.toml
./tools/process-mix/target/release/gbpm --job <path-to-job.json>
./tools/process-mix/target/release/gbpm <path-to-job.json>
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
  "album": "GBFM"
}
```

Local convention in this repo:

- Keep reusable cover art in `tools/process-mix/assets/covers/`.
- Keep one flat job file per mix in `tools/process-mix/jobs/`.
- Write generated results to `tools/process-mix/output/`.
- Start from `tools/process-mix/jobs/_template.json` when creating a new mix.

Prints the output file path to stdout on success.

## Architecture

```
job json
  → gbpm (Rust binary)
    → tools/process-mix/src/main.rs
      → parse_args
      → read_job_file
      → resolve_job_paths
      → process_mix
        → read audio + image files
        → write to tempdir (audio.mp3, cover.jpg, intro.wav from embedded bytes)
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
