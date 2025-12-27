import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transform-gpu active:scale-95',
  {
    variants: {
      variant: {
        default:
          'bg-gb-pastel-green-2 text-gb-darker-bg shadow-lg hover:shadow-xl hover:bg-gb-highlight hover:-translate-y-0.5 active:translate-y-0 active:shadow-md',
        destructive:
          'bg-red-600 text-white shadow-lg hover:shadow-xl hover:bg-red-700 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md',
        outline:
          'border-2 border-gb-pastel-green-2/30 bg-transparent text-gb-pastel-green-1 shadow-sm hover:bg-gb-pastel-green-2/20 hover:border-gb-highlight/50 hover:text-gb-highlight hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'bg-gb-bg text-gb-default-text shadow-md hover:shadow-lg hover:bg-gb-darker-bg hover:text-gb-pastel-green-1 hover:-translate-y-0.5 active:translate-y-0',
        ghost:
          'hover:bg-gb-pastel-green-2/20 hover:text-gb-highlight hover:shadow-md transition-all duration-150',
        link: 'text-gb-pastel-green-1 underline-offset-4 hover:underline hover:text-gb-highlight transition-colors duration-150'
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
