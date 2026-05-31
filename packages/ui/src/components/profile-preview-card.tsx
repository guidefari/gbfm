type ProfilePreviewCardProps = {
  displayName: string
  username: string
}

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function ProfilePreviewCard({ displayName, username }: ProfilePreviewCardProps) {
  const initials = getInitials(displayName)
  const handle = username.trim() ? `@${username.trim()}` : '@yourname'
  const name = displayName.trim() || 'Your Display Name'

  return (
    <div className='border border-gb-pastel-green-2/30 bg-gb-darker-bg/65 p-5 shadow-xl backdrop-blur-sm'>
      <p className='mb-3 text-xs font-semibold tracking-[0.18em] text-gb-pastel-green-2 uppercase'>
        Profile preview
      </p>
      <div className='flex items-center gap-4'>
        <div className='flex h-14 w-14 items-center justify-center border border-gb-pastel-green-2/40 bg-gb-pastel-green-2/15 text-lg font-bold text-gb-pastel-green-1'>
          {initials}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-base font-semibold text-foreground'>{name}</p>
          <p className='truncate text-sm text-muted-foreground'>{handle}</p>
        </div>
      </div>
      <p className='mt-4 text-xs leading-5 text-muted-foreground'>
        Your display name shows up on comments and your profile. Your username is your unique
        handle, used in URLs and to find you.
      </p>
    </div>
  )
}
