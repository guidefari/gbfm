import { auth } from './src/lib/auth'

console.log('API keys:', Object.keys(auth.api))
if (auth.api.signInEmail) {
  console.log('signInEmail is present')
}
if ((auth.api as any).forgotPassword) {
  console.log('forgotPassword is present')
}
if ((auth.api as any).forgetPassword) {
  console.log('forgetPassword is present')
}
if ((auth.api as any).requestPasswordReset) {
  console.log('requestPasswordReset is present')
}
if ((auth.api as any).refreshSession) {
  console.log('refreshSession is present')
}
