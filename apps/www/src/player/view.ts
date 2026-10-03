import * as Dialog from '@foldkit/ui/dialog'
import type { QueueTrackType } from '@gbfm/player'
import type { HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { artworkUrl } from '../view/artwork'
import { iconPaths, lucide } from '../view/icons'
import { Message, type Model } from './model'
import { queueSheet } from './queue-view'
import { fallbackArtwork, ghostButton, progressRangeClass, volumeRangeClass } from './view-styles'

type H = HtmlBuilder<typeof Message.Type>

const pad = (value: number) => value.toString().padStart(2, '0')

const time = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  return `${hours > 0 ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(Math.floor(safe % 60))}`
}

const creatorLinks = (h: H, track: QueueTrackType) => {
  const creators = track.creators ?? []

  if (creators.length === 0) return h.span([], ['Unknown creator'])

  return h.p(
    [h.Class('text-base text-muted-foreground')],
    creators.flatMap((creator, index) => [
      creator.username
        ? h.a(
            [
              h.Key(creator.id),
              h.Href(`/profile/${encodeURIComponent(creator.username)}`),
              h.Class('hover:text-foreground hover:underline'),
            ],
            [creator.name],
          )
        : h.span([h.Key(creator.id)], [creator.name]),
      index < creators.length - 1 ? ', ' : '',
    ]),
  )
}

const fullscreen = (model: Model, h: H, current: QueueTrackType) => {
  const { transport: playback, volume, queue } = model.snapshot
  const muted = volume.isMuted || volume.volume === 0

  return h.section(
    [
      h.AriaLabel('Now playing'),
      h.Class(
        'absolute inset-0 flex flex-col bg-background text-foreground animate-in slide-in-from-bottom fade-in duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]',
      ),
    ],
    [
      h.div(
        [h.Class('flex shrink-0 items-center justify-between px-4 py-3 sm:p-6')],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Collapse player'),
              h.OnClick(Message.CloseFullscreen()),
              h.Class(
                `${ghostButton} h-9 px-3 text-muted-foreground hover:bg-muted hover:text-foreground`,
              ),
            ],
            [lucide(iconPaths.chevronDown, 'h-6 w-6')],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            'flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-4 pb-6 sm:justify-center sm:px-8 sm:pb-8',
          ),
        ],
        [
          h.div(
            [h.Class('flex min-h-0 w-full max-w-2xl flex-1 flex-col')],
            [
              h.div(
                [h.Class('mb-4 flex min-h-0 flex-1 items-center justify-center sm:mb-8')],
                [
                  h.img([
                    h.Src(artworkUrl(current.thumbnailUrl || fallbackArtwork, 1280)),
                    h.Alt(current.title),
                    h.Class('max-h-full max-w-full rounded-sm object-contain shadow-2xl'),
                  ]),
                ],
              ),
              h.div(
                [h.Class('mb-4 shrink-0 sm:mb-8')],
                [
                  h.div(
                    [h.Class('mb-2 flex items-center justify-between')],
                    [
                      current.slug
                        ? h.a(
                            [
                              h.Href(`/mixes/${encodeURIComponent(current.slug)}`),
                              h.Class(
                                'min-w-0 flex-1 truncate pr-4 text-xl font-semibold leading-tight text-foreground hover:underline sm:text-2xl',
                              ),
                            ],
                            [current.title],
                          )
                        : h.span(
                            [
                              h.Class(
                                'min-w-0 flex-1 truncate pr-4 text-xl font-semibold leading-tight text-foreground sm:text-2xl',
                              ),
                            ],
                            [current.title],
                          ),
                      h.button(
                        [
                          h.Type('button'),
                          h.OnClick(Message.ToggleQueue()),
                          h.Title('Toggle queue'),
                          h.AriaLabel(`Queue (${queue.tracks.length})`),
                          h.Class(
                            `${ghostButton} relative h-9 w-9 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground`,
                          ),
                        ],
                        [
                          lucide(iconPaths.list, 'h-5 w-5'),
                          queue.tracks.length > 0
                            ? h.span(
                                [
                                  h.Class(
                                    'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-sm bg-primary text-xs text-primary-foreground',
                                  ),
                                ],
                                [String(queue.tracks.length)],
                              )
                            : h.empty,
                        ],
                      ),
                    ],
                  ),
                  creatorLinks(h, current),
                ],
              ),
              h.div(
                [h.Class('mb-4 shrink-0 sm:mb-8')],
                [
                  h.input([
                    h.Type('range'),
                    h.Min('0'),
                    h.Max(String(playback.duration || 0)),
                    h.Step('0.1'),
                    h.Value(String(playback.currentTime)),
                    h.OnInput((value) => Message.SeekTo({ seconds: Number(value) })),
                    h.AriaLabel('Playback position'),
                    h.Class(progressRangeClass),
                  ]),
                  h.div(
                    [h.Class('mt-2 flex justify-between text-base text-muted-foreground')],
                    [
                      h.span([], [time(playback.currentTime)]),
                      h.span([], [`-${time(playback.duration - playback.currentTime)}`]),
                    ],
                  ),
                ],
              ),
              h.div(
                [h.Class('mb-4 flex shrink-0 items-center justify-center gap-6 sm:mb-8')],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.Previous()),
                      h.AriaLabel('Previous track'),
                      h.Class(`${ghostButton} h-10 w-10 text-foreground hover:bg-muted`),
                    ],
                    [lucide(iconPaths.skipBack, 'h-7 w-7')],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.TogglePlayPause()),
                      h.AriaLabel(playback.isPlaying ? 'Pause' : 'Play'),
                      h.Class(
                        'inline-flex h-16 w-16 items-center justify-center rounded-sm border-0 bg-primary/20 p-0 text-foreground backdrop-blur-sm transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      ),
                    ],
                    [lucide(playback.isPlaying ? iconPaths.pause : iconPaths.play, 'h-8 w-8')],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.Next()),
                      h.AriaLabel('Next track'),
                      h.Class(`${ghostButton} h-10 w-10 text-foreground hover:bg-muted`),
                    ],
                    [lucide(iconPaths.skipForward, 'h-7 w-7')],
                  ),
                ],
              ),
              h.div(
                [h.Class('hidden items-center gap-4 sm:flex')],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.ToggleMute()),
                      h.AriaLabel(volume.isMuted ? 'Unmute' : 'Mute'),
                      h.Class(
                        `${ghostButton} h-9 px-3 text-muted-foreground hover:bg-muted hover:text-foreground`,
                      ),
                    ],
                    [lucide(muted ? iconPaths.volumeOff : iconPaths.volume, 'h-5 w-5')],
                  ),
                  h.input([
                    h.Type('range'),
                    h.Min('0'),
                    h.Max('100'),
                    h.Value(String(volume.isMuted ? 0 : volume.volume)),
                    h.OnInput((value) => Message.SetVolume({ volume: Number(value) })),
                    h.AriaLabel('Volume'),
                    h.Title(`Volume: ${volume.volume}%`),
                    h.Class(volumeRangeClass),
                  ]),
                  lucide(iconPaths.volume, 'h-5 w-5 text-muted-foreground'),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

const pendingQueue = (model: Model, h: H) =>
  h.div(
    [
      h.AriaLabel('Audio player'),
      h.Class(
        'fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-sm border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2',
      ),
    ],
    [
      h.span([], [`${model.snapshot.queue.tracks.length} queued`]),
      h.button(
        [
          h.Type('button'),
          h.OnClick(Message.PlayIndex({ index: 0 })),
          h.Class(`${ghostButton} gap-1 px-2 py-1 text-foreground hover:bg-muted`),
        ],
        [lucide(iconPaths.play, 'h-3 w-3 fill-current'), 'Play queue'],
      ),
      h.button(
        [
          h.Type('button'),
          h.OnClick(Message.ToggleQueue()),
          h.AriaLabel('Open queue'),
          h.Class(`${ghostButton} h-6 w-6 hover:bg-muted hover:text-foreground`),
        ],
        [lucide(iconPaths.list, 'h-3.5 w-3.5')],
      ),
    ],
  )

const playerDialog = (model: Model, h: H) =>
  h.submodel({
    slotId: 'player-dialog',
    model: model.playerDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({ dialog, panel, title, isVisible }) =>
        h.dialog(
          [...dialog, h.Class('overlay-dialog')],
          isVisible
            ? [
                h.h2([...title, h.Class('sr-only')], ['Now playing']),
                h.div(
                  [...panel],
                  [
                    model.snapshot.queue.current
                      ? fullscreen(model, h, model.snapshot.queue.current)
                      : h.p([], ['Loading player…']),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => Message.GotPlayerDialogMessage({ message }),
  })

export const view = defineView<Model, typeof Message.Type>((model, h) =>
  h.div(
    [],
    [
      playerDialog(model, h),
      !model.playerDialog.isOpen &&
      !model.snapshot.queue.current &&
      model.snapshot.queue.tracks.length
        ? pendingQueue(model, h)
        : h.empty,
      queueSheet(model, h),
    ],
  ),
)
