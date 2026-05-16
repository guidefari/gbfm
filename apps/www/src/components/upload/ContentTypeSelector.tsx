import { Button } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle,
  Disc3,
  List,
  Music,
  Sparkles
} from 'lucide-react'

export type ContentType = 'mix' | 'track' | 'misc'

export const CONTENT_TYPE_CONFIG = {
  mix: {
    icon: Disc3,
    title: 'DJ Mix',
    description: 'A continuous set blending multiple tracks together',
    features: [
      'Tracklist timestamps',
      'Seamless transitions',
      'Long-form content'
    ],
    color: 'gb-highlight'
  },
  track: {
    icon: Music,
    title: 'Track',
    description: 'A single song or production',
    features: ['Production credits', 'BPM & key info', 'Short-form content'],
    color: 'gb-pastel-green-1'
  },
  misc: {
    icon: Sparkles,
    title: 'Other',
    description: 'Podcasts, samples, sound design, etc.',
    features: ['Flexible format', 'Any audio type', 'Custom metadata'],
    color: 'gb-pastel-green-2'
  }
}

interface ContentTypeSelectorProps {
  onSelect: (type: ContentType) => void
}

export function ContentTypeSelector({ onSelect }: ContentTypeSelectorProps) {
  return (
    <div className='px-4 py-8 mx-auto max-w-4xl sm:px-6 lg:px-8'>
      <div className='mb-8 text-center'>
        <h1 className='text-3xl font-bold text-gb-highlight'>Upload Audio</h1>
        <p className='mt-2 text-gb-default-text'>
          What type of content are you uploading?
        </p>
      </div>

      <div className='grid gap-6 md:grid-cols-3'>
        {(
          Object.entries(CONTENT_TYPE_CONFIG) as [
            ContentType,
            typeof CONTENT_TYPE_CONFIG.mix
          ][]
        ).map(([type, config]) => {
          const Icon = config.icon
          return (
            <button
              key={type}
              type='button'
              onClick={() => onSelect(type)}
              className='p-6 text-left transition-all border rounded-sm group bg-gb-darker-bg border-gb-pastel-green-2/20 hover:border-gb-highlight/50 hover:shadow-lg hover:-translate-y-1'>
              <div
                className={`flex items-center justify-center w-12 h-12 mb-4 rounded-sm bg-${config.color}/20 group-hover:bg-${config.color}/30 transition-colors`}>
                <Icon className={`w-6 h-6 text-${config.color}`} />
              </div>
              <h3 className='mb-2 text-lg font-bold text-gb-pastel-green-1'>
                {config.title}
              </h3>
              <p className='mb-4 text-sm text-muted-foreground'>
                {config.description}
              </p>
              <ul className='space-y-1'>
                {config.features.map((feature) => (
                  <li
                    key={feature}
                    className='flex items-center gap-2 text-xs text-gb-default-text'>
                    <CheckCircle className='w-3 h-3 text-gb-pastel-green-2' />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <div className='p-6 mt-8 border rounded-sm bg-gb-darker-bg border-gb-highlight/30'>
        <div className='flex items-start gap-4'>
          <div className='flex items-center justify-center shrink-0 w-12 h-12 rounded-sm bg-gb-highlight/20'>
            <List className='w-6 h-6 text-gb-highlight' />
          </div>
          <div className='flex-1'>
            <h3 className='mb-1 text-lg font-bold text-gb-highlight'>
              Uploading a DJ Mix?
            </h3>
            <p className='mb-3 text-sm text-gb-default-text'>
              Use our dedicated mix uploader to automatically mark tracklist
              timestamps as you play through your set.
            </p>
            <Link to='/mix-upload'>
              <Button className='bg-gb-highlight hover:bg-gb-pastel-green-1 text-gb-darker-bg'>
                Go to Mix Uploader
                <ArrowRight className='w-4 h-4 ml-2' />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function getTypeLabel(type: string): string {
  return CONTENT_TYPE_CONFIG[type as ContentType]?.title || type
}
