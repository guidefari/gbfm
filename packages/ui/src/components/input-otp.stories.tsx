import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from './input-otp'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Input OTP'
}

export function InputOtps() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Forms'
        title='Input OTP'
        description='Segmented one-time-code entry.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Verification code</CardTitle>
          <CardDescription>Six-character filled state.</CardDescription>
        </CardHeader>
        <CardContent>
          <InputOTP maxLength={6} value='042681'>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </CardContent>
      </Card>
    </div>
  )
}
