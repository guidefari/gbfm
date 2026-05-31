# Mix Processing

Local CLI pipeline that takes a raw audio file + cover image, runs FFmpeg to embed metadata/artwork (MP3) or produce a video with a still image (MP4), and writes the result to disk.

## CLI

`bun run process-mix --audio <path> --image <path> --title <title> --description <tracklist> --format <mp3|mp4> [--artist <name>] [--album <name>] [--output <path>] [--intro <path>]`

| Flag | Type | Required |
|---|---|---|
| `--audio` | path | yes |
| `--image` | path | yes |
| `title` | string | yes |
| `--description` | string | yes |
| `--format` | `mp3` \| `mp4` | yes |
| `--artist` | string | no |
| `--album` | string | no |
| `--output` | path | no |

Prints the output file path to stdout on success.

## Architecture

```
Raycast / terminal
  → bun run process-mix
    → packages/core/src/mix-processing/cli.ts
      → processMix (core package)
        → writeFilesToDisk
        → createAudioOrVideo
        → read output buffer
        → cleanup(files)
      → write final output to requested path
```

## Temp File Cleanup

`processMix` uses `Effect.ensuring(cleanup(files))` so the tmpdir is always removed, whether FFmpeg succeeds, fails, or the fiber is interrupted. The only unhandled case is an OS-level kill mid-FFmpeg, where `/tmp/mix-*` files persist until the OS clears `/tmp`.

## Known Limitations

- **No batch mode**: each invocation processes one mix.
- **No concurrency limit**: running many CLI jobs in parallel can still exhaust memory or file descriptors.

## Gotchas

### Output path default

If `--output` is omitted, the CLI writes to `./<safe_title>.<format>` in the current working directory.
