import { MusicEntityCard, type MusicEntityCardProps } from './MusicEntityCard'

export type MusicEntityProps = MusicEntityCardProps

export function MusicEntity(props: MusicEntityProps) {
  return (
    <div className='my-6'>
      <MusicEntityCard {...props} />
    </div>
  )
}
