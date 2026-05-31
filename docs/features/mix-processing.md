# Mix Processing

Local CLI pipeline that takes a job JSON file, reads a raw audio file plus cover image, runs FFmpeg to embed metadata and artwork for MP3 or produce a video with a still image for MP4, then writes the result to disk.

## CLI

`bun run process-mix --job <path-to-job.json>`

`bun run process-mix <path-to-job.json>`

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
  → bun run process-mix
    → packages/core/src/mix-processing/cli.ts
      → runMixProcessing
        → processMix
          → writeFilesToDisk
          → createAudioOrVideo
          → read output buffer
          → cleanup(files)
      → write final output to requested path
```

## Temp File Cleanup

`processMix` uses `Effect.ensuring(cleanup(files))` so the tmpdir is always removed, whether FFmpeg succeeds, fails, or the fiber is interrupted. The only unhandled case is an OS-level kill mid-FFmpeg, where `/tmp/mix-*` files persist until the OS clears `/tmp`.

## Known Limitations

- Each invocation processes one job file.
- Running many jobs in parallel can still exhaust memory or file descriptors.

## Gotchas

### Output path default

If `outputPath` is omitted, the CLI writes to `<safe_title>.<format>` next to the job file.

### Default intro audio

If `introAudioPath` is omitted, the CLI uses `apps/vps/public/intro.wav` from this repository.
