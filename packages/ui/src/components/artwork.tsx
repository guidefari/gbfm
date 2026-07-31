import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '../lib/cn'

const artworkVariants = cva('overflow-hidden bg-background', {
  variants: {
    aspect: {
      square: 'aspect-square',
      auto: ''
    },
    radius: {
      none: 'rounded-none',
      sm: 'rounded-sm',
      md: 'rounded-md'
    },
    border: {
      none: '',
      thin: 'border border-border',
      thick: 'border-2 border-border'
    }
  },
  defaultVariants: {
    aspect: 'square',
    radius: 'sm',
    border: 'thin'
  }
})

const imageVariants = cva('h-full w-full object-cover', {
  variants: {
    hover: {
      none: '',
      fade: 'transition-opacity duration-300 group-hover:opacity-80',
      zoom: 'transition duration-300 group-hover:scale-105',
      ring: 'transition duration-300 group-hover:ring-4 ring-highlight'
    },
    loading: {
      true: 'scale-102 blur-2xl',
      false: 'scale-100 blur-0'
    }
  },
  defaultVariants: {
    hover: 'none',
    loading: false
  }
})

export interface ArtworkProps
  extends
    Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading'>,
    VariantProps<typeof artworkVariants> {
  src: string | null | undefined
  alt: string
  fallbackSrc: string
  hover?: VariantProps<typeof imageVariants>['hover']
  isLoading?: boolean
  overlay?: React.ReactNode
  className?: string
  imageClassName?: string
}

function Artwork({
  src,
  alt,
  fallbackSrc,
  aspect,
  radius,
  border,
  hover,
  isLoading = false,
  overlay,
  className,
  imageClassName,
  ...props
}: ArtworkProps) {
  return (
    <div className={cn('relative', artworkVariants({ aspect, radius, border }), className)}>
      <img
        src={src || fallbackSrc}
        alt={alt}
        loading='lazy'
        className={cn(imageVariants({ hover, loading: isLoading }), imageClassName)}
        {...props}
      />
      {overlay}
    </div>
  )
}

export { Artwork, artworkVariants }
