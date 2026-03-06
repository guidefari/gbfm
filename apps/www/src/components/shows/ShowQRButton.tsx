import { Download, Loader2, QrCode } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { useShowQRPdf } from '@/lib/http'
import { useAuthStore } from '@/store/auth'

interface ShowQRButtonProps {
  slug: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function ShowQRButton({
  slug,
  variant = 'outline',
  size = 'sm',
  className
}: ShowQRButtonProps) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()

  const [qrTemplate, setQrTemplate] = React.useState<'flyer' | 'qr' | null>(
    null
  )
  const { data: qrPdf, isFetching: isGeneratingPdf } = useShowQRPdf(
    slug,
    qrTemplate || 'flyer',
    !!qrTemplate
  )

  React.useEffect(() => {
    if (qrPdf?.url && qrTemplate) {
      window.open(qrPdf.url, '_blank')
      setQrTemplate(null)
    }
  }, [qrPdf, qrTemplate])

  const handleDownloadQR = (template: 'flyer' | 'qr') => {
    setQrTemplate(template)
    toast({
      title: 'Generating PDF...',
      description: 'Your QR code PDF will download shortly',
      duration: 3000
    })
  }

  if (!isAdmin) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <QrCode className='w-4 h-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleDownloadQR('flyer')}>
          {isGeneratingPdf && qrTemplate === 'flyer' ? (
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : (
            <Download className='w-4 h-4' />
          )}
          <span>Download flyer</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownloadQR('qr')}>
          {isGeneratingPdf && qrTemplate === 'qr' ? (
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : (
            <QrCode className='w-4 h-4' />
          )}
          <span>Download QR</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
