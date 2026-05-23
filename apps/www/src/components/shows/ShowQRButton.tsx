import { Button, useToast } from '@gbfm/ui'
import { Loader2, QrCode } from 'lucide-react'
import * as React from 'react'
import { useSession } from '@/lib/auth-client'
import { useShowQRPdf } from '@/lib/http'

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
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const { toast } = useToast()

  const [enabled, setEnabled] = React.useState(false)
  const { data: qrPdf, isFetching: isGeneratingPdf } = useShowQRPdf(
    slug,
    enabled
  )

  React.useEffect(() => {
    if (qrPdf?.url && enabled) {
      window.open(qrPdf.url, '_blank')
      setEnabled(false)
    }
  }, [qrPdf, enabled])

  const handleDownloadQR = () => {
    setEnabled(true)
    toast({
      title: 'Generating PDF...',
      description: 'Your QR code PDF will download shortly',
      duration: 3000
    })
  }

  if (!isAdmin) return null

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDownloadQR}>
      {isGeneratingPdf ? (
        <Loader2 className='w-4 h-4 animate-spin' />
      ) : (
        <QrCode className='w-4 h-4' />
      )}
    </Button>
  )
}
