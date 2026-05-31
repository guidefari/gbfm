# Auth

- I want to support email and password
- I want to support emailing a code
- I want to support emailing a login link
- I want to use AWS SES to send emails out

## Auth flows

Here's a comprehensive list of general authentication flows for a typical SaaS application:

1. Sign Up Flow

- Email/password registration

2. Sign In Flow

- Email/password login
- Magic link login
- Remember me functionality
-

3. Forgot Password Flow

- Request password reset
- Send password reset email
- Validate reset token
- Password reset page
- Password strength validation
- Notification of password change

4. Account Verification Flow

- Email verification

5. Session Management

- Login session tracking
- Session timeout
- Concurrent login handling
- Device management
- Login history

6. Logout Flow

- Single device logout
- Logout from all devices
- Session invalidation

<!-- 7. Account Recovery
- Account recovery via verified email
- Account recovery via support
- Account deletion process

8. Additional Security Flows
- Suspicious login detection
- IP/location-based restrictions
- Brute force protection
- CAPTCHA integration -->

## Database

- Should follow provider pattern, allowing me to switch from local postgres, to Neon, and whatever other postres
- SHould use drizzle

## Helpers & Providers

- S3 client
- Email sender client
