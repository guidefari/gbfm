import {
  CommandGroup,
  CommandItem,
  CommandShortcut
} from '@/components/ui/command'
import { useAudioPlayerCmdActions } from './actions'

interface AudioCommandsProps {
  closeCmd: () => void
}

export const AudioCommands = ({ closeCmd }: AudioCommandsProps) => {
  const audioPlayerActions = useAudioPlayerCmdActions(closeCmd)

  return (
    <>
      <CommandGroup heading='Playback Controls'>
        <CommandItem onSelect={audioPlayerActions.actions.togglePlayPause}>
          {audioPlayerActions.isPlaying ? (
            <audioPlayerActions.icons.Pause />
          ) : (
            <audioPlayerActions.icons.Play />
          )}
          <span>{audioPlayerActions.isPlaying ? 'Pause' : 'Play'}</span>
          <CommandShortcut>Space</CommandShortcut>
        </CommandItem>

        {audioPlayerActions.canPlayPrevious && (
          <CommandItem onSelect={audioPlayerActions.actions.playPrevious}>
            <audioPlayerActions.icons.SkipBack />
            <span>Previous Track</span>
            <CommandShortcut>←</CommandShortcut>
          </CommandItem>
        )}

        {audioPlayerActions.canPlayNext && (
          <CommandItem onSelect={audioPlayerActions.actions.playNext}>
            <audioPlayerActions.icons.SkipForward />
            <span>Next Track</span>
            <CommandShortcut>→</CommandShortcut>
          </CommandItem>
        )}

        <CommandItem onSelect={audioPlayerActions.actions.jumpBackward}>
          <audioPlayerActions.icons.SkipBack />
          <span>Jump Backward (10s)</span>
          <CommandShortcut>⌥←</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.jumpForward}>
          <audioPlayerActions.icons.SkipForward />
          <span>Jump Forward (10s)</span>
          <CommandShortcut>⌥→</CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading='Volume Controls'>
        <CommandItem onSelect={audioPlayerActions.actions.toggleMute}>
          {audioPlayerActions.isMuted ? (
            <audioPlayerActions.icons.VolumeX />
          ) : (
            <audioPlayerActions.icons.Volume2 />
          )}
          <span>{audioPlayerActions.isMuted ? 'Unmute' : 'Mute'}</span>
          <CommandShortcut>M</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.volumeUp}>
          <audioPlayerActions.icons.Volume2 />
          <span>Volume Up</span>
          <CommandShortcut>⌥↑</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.volumeDown}>
          <audioPlayerActions.icons.Volume2 />
          <span>Volume Down</span>
          <CommandShortcut>⌥↓</CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading='Player Controls'>
        <CommandItem onSelect={audioPlayerActions.actions.toggleQueue}>
          <audioPlayerActions.icons.List />
          <span>
            {audioPlayerActions.isQueueVisible ? 'Hide' : 'Show'} Queue
          </span>
          <CommandShortcut>Q</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.toggleFullscreen}>
          <audioPlayerActions.icons.Maximize2 />
          <span>
            {audioPlayerActions.isFullscreenVisible ? 'Exit' : 'Enter'}{' '}
            Fullscreen
          </span>
          <CommandShortcut>F</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.toggleShuffle}>
          <audioPlayerActions.icons.Shuffle />
          <span>
            {audioPlayerActions.isShuffled ? 'Disable' : 'Enable'} Shuffle
          </span>
          <CommandShortcut>S</CommandShortcut>
        </CommandItem>

        <CommandItem onSelect={audioPlayerActions.actions.toggleRepeat}>
          {audioPlayerActions.repeatMode === 'one' ? (
            <audioPlayerActions.icons.Repeat1 />
          ) : (
            <audioPlayerActions.icons.Repeat />
          )}
          <span>
            {audioPlayerActions.repeatMode === 'none' && 'Enable Repeat'}
            {audioPlayerActions.repeatMode === 'one' && 'Repeat One'}
            {audioPlayerActions.repeatMode === 'all' && 'Repeat All'}
          </span>
          <CommandShortcut>R</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </>
  )
}
