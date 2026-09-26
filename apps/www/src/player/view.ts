import type { QueueTrackType } from '@gbfm/player'
import type { HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { Message, type Model } from './model'

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`

const creator = (track: QueueTrackType) =>
  track.creators?.map(({ name }) => name).join(', ') || 'Unknown creator'

const transport = (model: Model, h: HtmlBuilder<typeof Message.Type>, large: boolean) => {
  const { transport } = model.snapshot

  return h.div(
    [h.Class(large ? 'player-transport player-transport-large' : 'player-transport')],
    [
      h.button(
        [h.OnClick(Message.Previous()), h.AriaLabel('Previous track'), h.Title('Previous track')],
        ['◀|'],
      ),
      h.button(
        [h.OnClick(Message.Jump({ seconds: -10 })), h.AriaLabel('Back 10 seconds')],
        ['−10'],
      ),
      h.button(
        [
          h.Class('player-play'),
          h.OnClick(Message.TogglePlayPause()),
          h.AriaLabel(transport.isPlaying ? 'Pause' : 'Play'),
        ],
        [transport.isPlaying ? 'Ⅱ' : '▶'],
      ),
      h.button(
        [h.OnClick(Message.Jump({ seconds: 10 })), h.AriaLabel('Forward 10 seconds')],
        ['+10'],
      ),
      h.button(
        [h.OnClick(Message.Next()), h.AriaLabel('Next track'), h.Title('Next track')],
        ['|▶'],
      ),
    ],
  )
}

const queue = (model: Model, h: HtmlBuilder<typeof Message.Type>) =>
  !model.queueOpen
    ? h.empty
    : h.aside(
        [h.Class('player-queue'), h.AriaLabel('Playback queue')],
        [
          h.header(
            [],
            [
              h.div([], [h.h2([], ['Queue']), h.p([], ['Choose or reorder what plays next.'])]),
              h.button([h.OnClick(Message.CloseQueue()), h.AriaLabel('Close queue')], ['×']),
            ],
          ),
          h.ol(
            [],
            model.snapshot.queue.tracks.map((track, index) =>
              h.li(
                [
                  h.Key(track.id),
                  h.Draggable(true),
                  h.OnDragStart(Message.DragStarted({ index })),
                  h.OnDragOver(Message.OperationCompleted()),
                  h.OnDrop(Message.DroppedAt({ index })),
                  h.Class(index === model.snapshot.queue.currentIndex ? 'current' : ''),
                ],
                [
                  track.thumbnailUrl
                    ? h.img([h.Src(track.thumbnailUrl), h.Alt('')])
                    : h.span([h.Class('player-queue-placeholder')], ['♪']),
                  h.button(
                    [h.Class('player-queue-title'), h.OnClick(Message.PlayIndex({ index }))],
                    [
                      h.strong([], [track.title]),
                      h.small(
                        [],
                        [
                          index === model.snapshot.queue.currentIndex
                            ? 'Now playing'
                            : creator(track),
                        ],
                      ),
                    ],
                  ),
                  h.button(
                    [
                      h.OnClick(Message.Reorder({ from: index, to: index - 1 })),
                      h.Disabled(index === 0),
                      h.AriaLabel(`Move ${track.title} up`),
                    ],
                    ['↑'],
                  ),
                  h.button(
                    [
                      h.OnClick(Message.Reorder({ from: index, to: index + 1 })),
                      h.Disabled(index === model.snapshot.queue.tracks.length - 1),
                      h.AriaLabel(`Move ${track.title} down`),
                    ],
                    ['↓'],
                  ),
                  h.button(
                    [h.OnClick(Message.Remove({ index })), h.AriaLabel(`Remove ${track.title}`)],
                    ['×'],
                  ),
                ],
              ),
            ),
          ),
          h.footer(
            [],
            [
              h.button(
                [h.OnClick(Message.Clear()), h.Disabled(model.snapshot.queue.tracks.length === 0)],
                ['Clear queue'],
              ),
            ],
          ),
        ],
      )

export const view = defineView<Model, typeof Message.Type>((model, h) => {
  const current = model.snapshot.queue.current

  if (!current) return queue(model, h)
  const { transport: playback, volume } = model.snapshot

  return h.div(
    [h.Class('gbfm-player-root')],
    [
      model.fullscreen
        ? h.section(
            [h.Class('player-fullscreen'), h.AriaLabel('Now playing')],
            [
              h.header(
                [],
                [
                  h.button(
                    [h.OnClick(Message.CloseFullscreen()), h.AriaLabel('Collapse player')],
                    ['⌄'],
                  ),
                  h.button(
                    [h.OnClick(Message.ToggleQueue())],
                    [`Queue (${model.snapshot.queue.tracks.length})`],
                  ),
                ],
              ),
              h.div(
                [h.Class('player-fullscreen-content')],
                [
                  current.thumbnailUrl
                    ? h.img([
                        h.Class('player-artwork-large'),
                        h.Src(current.thumbnailUrl),
                        h.Alt(current.title),
                      ])
                    : h.div([h.Class('player-artwork-large player-artwork-placeholder')], ['♪']),
                  h.div(
                    [h.Class('player-copy')],
                    [h.h1([], [current.title]), h.p([], [creator(current)])],
                  ),
                  h.input([
                    h.Type('range'),
                    h.Min('0'),
                    h.Max(String(playback.duration || 0)),
                    h.Step('0.1'),
                    h.Value(String(playback.currentTime)),
                    h.OnInput((value) => Message.SeekTo({ seconds: Number(value) })),
                    h.AriaLabel('Playback position'),
                  ]),
                  h.div(
                    [h.Class('player-time')],
                    [
                      h.span([], [time(playback.currentTime)]),
                      h.span(
                        [],
                        [`-${time(Math.max(0, playback.duration - playback.currentTime))}`],
                      ),
                    ],
                  ),
                  transport(model, h, true),
                  h.div(
                    [h.Class('player-volume')],
                    [
                      h.button(
                        [
                          h.OnClick(Message.ToggleMute()),
                          h.AriaLabel(volume.isMuted ? 'Unmute' : 'Mute'),
                        ],
                        [volume.isMuted ? '🔇' : '🔊'],
                      ),
                      h.input([
                        h.Type('range'),
                        h.Min('0'),
                        h.Max('100'),
                        h.Value(String(volume.isMuted ? 0 : volume.volume)),
                        h.OnInput((value) => Message.SetVolume({ volume: Number(value) })),
                        h.AriaLabel('Volume'),
                      ]),
                      h.span([], [`${volume.volume}%`]),
                    ],
                  ),
                ],
              ),
            ],
          )
        : h.empty,
      h.section(
        [h.Class('player-bar'), h.AriaLabel('Audio player')],
        [
          current.thumbnailUrl
            ? h.img([h.Src(current.thumbnailUrl), h.Alt('')])
            : h.span([h.Class('player-bar-art')], ['♪']),
          h.button(
            [h.Class('player-bar-copy'), h.OnClick(Message.ToggleFullscreen())],
            [h.strong([], [current.title]), h.small([], [creator(current)])],
          ),
          transport(model, h, false),
          h.input([
            h.Class('player-progress'),
            h.Type('range'),
            h.Min('0'),
            h.Max(String(playback.duration || 0)),
            h.Step('0.1'),
            h.Value(String(playback.currentTime)),
            h.OnInput((value) => Message.SeekTo({ seconds: Number(value) })),
            h.AriaLabel('Playback position'),
          ]),
          h.button(
            [h.OnClick(Message.ToggleQueue()), h.AriaLabel('Open queue')],
            [`Queue ${model.snapshot.queue.tracks.length}`],
          ),
          h.button(
            [h.OnClick(Message.ToggleFullscreen()), h.AriaLabel('Open fullscreen player')],
            ['↗'],
          ),
        ],
      ),
      queue(model, h),
    ],
  )
})
