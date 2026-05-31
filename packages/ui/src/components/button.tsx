import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../lib/cn'

const buttonVariants = cva(
  'inline-flex transform-gpu items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-lg hover:-translate-y-0.5 hover:bg-highlight hover:text-highlight-foreground hover:shadow-xl active:translate-y-0 active:shadow-md',
        destructive:
          'bg-destructive text-destructive-foreground shadow-lg hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-xl active:translate-y-0 active:shadow-md',
        outline:
          'border-2 border-border/70 bg-transparent text-foreground shadow-sm hover:-translate-y-0.5 hover:border-highlight/60 hover:bg-accent hover:text-highlight hover:shadow-lg active:translate-y-0',
        secondary:
          'border border-border bg-secondary text-secondary-foreground shadow-md hover:-translate-y-0.5 hover:border-highlight/60 hover:bg-accent hover:text-highlight hover:shadow-lg active:translate-y-0',
        ghost: 'text-foreground hover:bg-accent hover:text-highlight hover:shadow-md',
        link: 'text-highlight underline-offset-4 transition-colors duration-150 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-sm px-3 text-xs',
        lg: 'h-12 rounded-sm px-8 text-base',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
