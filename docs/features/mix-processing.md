# Mix Processing

Async pipeline that takes a raw audio file + cover image, runs FFmpeg to embed metadata/artwork (MP3) or produce a video with a still image (MP4), uploads the result to S3, and returns a job ID the client can poll.

## Endpoint

`POST /content/mixes/process/async` — multipart/form-data, requires auth.

| Field | Type | Required |
|---|---|---|
| `audioFile` | File | yes |
| `coverImage` | File | yes |
| `title` | string | yes |
| `description` | string | yes |
| `outputFormat` | `mp3` \| `mp4` | yes |
| `artist` | string | no |
| `album` | string | no |

Returns `{ jobId, status: "Queued" }` immediately (HTTP 202).

Poll status at `GET /content/mixes/jobs/:jobId`.

## Architecture

```
Raycast / web / mobile
  → POST multipart
    → betterAuthMiddleware (reads Authorization header only, does not consume body)
    → await c.req.formData()           # resolved before entering Effect program
    → submitMixProcessing handler
      → MixProcessingService.submitJob
        → MixJobQueue.submit           # sets status = Queued
        → Effect.forkDaemon            # returns jobId to client immediately
          → processMix (core package)
            → writeFilesToDisk         # tmpdir per job
            → createAudioOrVideo       # spawns ffmpeg
            → read output buffer
            → cleanup(files)           # always runs via Effect.ensuring
          → S3Service.uploadFile       # config.buckets.userContent
          → MixJobQueue.updateStatus   # Completed | Failed
```

## Job Queue

In-memory `HashMap` backed by an Effect `Ref`. Jobs are never persisted — a process restart loses all queue state.

**Eviction:** a background fiber runs every 10 minutes and removes completed/failed jobs older than 1 hour, preventing unbounded memory growth.

**Stale jobs:** any job found in `Processing` state at queue initialisation is immediately marked `Failed` with reason "Server restarted during processing". Currently a no-op (queue starts empty on boot) but is the correct invariant if persistence is ever added.

## Temp File Cleanup

`processMix` uses `Effect.ensuring(cleanup(files))` so the tmpdir is always removed — whether FFmpeg succeeds, fails, or the fiber is interrupted. The only unhandled case is an OS-level kill mid-FFmpeg, where `/tmp/mix-*` files persist until the OS clears `/tmp`.

## Known Limitations

- **No persistence** — job state is lost on restart; polling clients get 404 and have no recovery path.
- **No concurrency limit** — every submitted job forks a daemon fiber and spawns an FFmpeg process immediately. Under load this could exhaust memory or file descriptors.
- **Hard-coded CDN URL** — output URL is constructed as `https://cdn.goosebumps.fm/processed-mixes/{jobId}/{title}.{format}`. The bucket name comes from `config.buckets.userContent`.

## Gotchas

### `c.req.formData()` must be awaited before entering Effect

`@hono/zod-openapi` validates the multipart body during the middleware chain and caches the parsed `FormData` object (not a Promise) in `bodyCache.formData`. When `c.req.formData()` is called after this, Hono returns the cached value directly — a plain `FormData`, not a `Promise<FormData>`. Wrapping it in `Effect.tryPromise` causes Effect to call `.then()` on a non-thenable, producing the error:

```
Failed to parse form data: evaluate().then is not a function
```

**Fix:** always `await c.req.formData()` outside the Effect program, then reference the resolved value inside.

### S3 bucket

Use `config.buckets.userContent` — not `process.env.CDN_BUCKET_NAME`.
