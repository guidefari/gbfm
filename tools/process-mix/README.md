# gbpm

Rust CLI that takes a job JSON file, reads raw audio + cover image, runs FFmpeg to embed metadata/artwork (MP3) or produce a video with a still image (MP4), then writes the result to disk.

The intro audio is embedded in the binary at compile time — no external files needed.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/guidefari/gbfm/prod/tools/process-mix/install.sh | bash
```

This downloads the latest release binary for your platform and installs it to `~/.local/bin/`.

Set `INSTALL_DIR` to override the install location:

```bash
curl -fsSL https://raw.githubusercontent.com/guidefari/gbfm/prod/tools/process-mix/install.sh | INSTALL_DIR=/usr/local/bin bash
```

Requires `ffmpeg` in PATH.

## Build from source

```bash
cargo build --release
```

## Run

```bash
./target/release/gbpm --job path/to/job.json
./target/release/gbpm path/to/job.json
```

## Job file

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

All paths are resolved relative to the job file. If `outputPath` is omitted, it defaults to `<safe_title>.<format>` next to the job file.

Requires `ffmpeg` in PATH.
