import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Rule = {
  label: string
  test: (password: string) => boolean
}

const rules: Rule[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 }
]

export function isPasswordValid(password: string) {
  return rules.every((r) => r.test(password))
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className='mt-2 space-y-1 text-xs'>
      {rules.map((rule) => {
        const ok = rule.test(password)
        const Icon = ok ? Check : Circle
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-2 transition-colors',
              ok ? 'text-gb-pastel-green-1' : 'text-muted-foreground'
            )}>
            <Icon className='h-3 w-3' />
            <span>{rule.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
