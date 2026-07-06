import { Check } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

type ThemePreference = 'light' | 'dark' | 'system'

const themeOptions: Array<{
  value: ThemePreference
  title: string
  description: string
}> = [
  {
    value: 'light',
    title: 'Light',
    description: 'Always use the light interface'
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'Always use the dark interface'
  },
  {
    value: 'system',
    title: 'System',
    description: 'Follow your device preference'
  }
]

export function ThemePreferencesCard() {
  const { theme, setTheme } = useTheme()

  return (
    <div className='space-y-8'>
      <div className='space-y-1'>
        <h3 className='text-sm font-bold tracking-widest text-muted-foreground'>Appearance</h3>
        <p className='text-xs text-muted-foreground font-medium tracking-wider'>
          Choose how gbfm looks on this device
        </p>
      </div>

      <div className='flex flex-col md:flex-row gap-6'>
        {themeOptions.map((option) => (
          <ThemeOption
            key={option.value}
            active={theme === option.value}
            onClick={() => setTheme(option.value)}
            title={option.title}
            description={option.description}
          />
        ))}
      </div>
    </div>
  )
}

function ThemeOption({
  active,
  onClick,
  title,
  description
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`
        flex-1 flex flex-col gap-2 p-6 rounded-none border-2 transition-all duration-300 text-left relative
        ${
          active
            ? 'border-primary bg-muted text-foreground'
            : 'border-border text-muted-foreground hover:border-primary/50'
        }
      `}>
      {active && (
        <div className='absolute top-4 right-4'>
          <Check className='w-4 h-4 text-primary' />
        </div>
      )}
      <div className='text-sm font-bold tracking-widest'>{title}</div>
      <div className='text-xs font-medium tracking-wider opacity-70 leading-relaxed'>
        {description}
      </div>
    </button>
  )
}
