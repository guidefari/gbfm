# @gbfm/email

React Email package for goosebumps.fm email templates with SES delivery.

## Features

- 🎨 **React Email Templates**: Build beautiful emails with React components
- 📧 **SES Integration**: Leverages existing SES delivery infrastructure from `@gbfm/core`
- 🔥 **Live Preview**: Development server with hot reload at `localhost:3000`
- 🧪 **Test Utilities**: Easy test email sending for development
- 📦 **Type Safe**: Full TypeScript support for template props

## Development

### Start React Email Preview Server

```bash
# From packages/email/
bun dev

# Or via SST dev command
sst dev # Then run "Email_Preview" command
```

The preview server will start at `http://localhost:3000` and show all your email templates.

### Send Test Emails

```bash
# Send test email to default address
bun test:send

# Send test email to specific address
bun test:send your-email@example.com
```

## Email Templates

Templates are located in the `emails/` directory:

- `test-email.tsx` - Development test template
- `welcome.tsx` - User welcome email
- `password-reset.tsx` - Password reset email

## Usage

### Import and Send Emails

```typescript
import { sendWelcomeEmail, sendPasswordResetEmail, sendTestEmail } from '@gbfm/email'

// Send welcome email
await sendWelcomeEmail({
  to: 'user@example.com',
  username: 'John Doe',
  loginUrl: 'https://goosebumps.fm/auth/signin'
})

// Send password reset
await sendPasswordResetEmail({
  to: 'user@example.com',
  resetUrl: 'https://goosebumps.fm/auth/reset?token=xyz',
  expiresIn: '1 hour'
})

// Send test email (development)
await sendTestEmail({
  to: 'dev@example.com'
})
```

### Custom Email Templates

```typescript
import { sendEmail } from "@gbfm/email";
import { render } from "@react-email/components";

// Create custom template
const MyTemplate = ({ name }: { name: string }) => (
  <Html>
    <Body>
      <Text>Hello {name}!</Text>
    </Body>
  </Html>
);

// Send custom email
await sendEmail({
  to: "recipient@example.com",
  from: "custom",
  template: {
    subject: "Custom Email",
    component: <MyTemplate name="User" />
  }
});
```

## Directory Structure

```
packages/email/
├── emails/              # React Email templates
│   ├── test-email.tsx
│   ├── welcome.tsx
│   └── password-reset.tsx
├── src/
│   ├── sender.ts        # SES integration layer
│   ├── test-send.ts     # Test email utility
│   └── index.ts         # Main exports
├── package.json
└── README.md
```

## Environment

The package uses the existing SES configuration from `@gbfm/core` via SST Resources. No additional environment setup is required.

## Development Workflow

1. **Template Development**: Use `bun dev` to start the preview server and develop templates visually
2. **Test Delivery**: Use `bun test:send` to test actual email delivery
3. **Integration**: Import and use email functions in your applications
4. **Preview**: Access the live preview server through the SST dev command "Email_Preview"
