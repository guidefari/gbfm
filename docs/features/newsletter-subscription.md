# Newsletter Subscription Feature

## Overview

The Newsletter Subscription feature allows visitors to subscribe to the goosebumps newsletter directly through the website. Subscriptions are stored in the VPS database, replacing the previous external Buttondown integration.

## Implementation Status ✅

- **Database Schema**: ✅ Complete (newsletter_subscribers table)
- **API Endpoint**: ✅ Complete (POST /newsletter/subscribe)
- **Frontend UI**: ✅ Complete (React form with loading/success states)
- **Email Sending**: ❌ Not implemented (subscribers stored, no emails sent yet)

## Architecture

### Core Components

- **Database**: PostgreSQL with Drizzle ORM
- **Backend**: Hono.js API with zod-openapi validation
- **Frontend**: React with TanStack Query mutation

## Database Schema

### Newsletter Subscribers Table

```sql
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  source VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX newsletter_subscribers_email_idx ON newsletter_subscribers(email);
```

**Key Fields:**
- `email`: Subscriber's email address (unique, normalized to lowercase)
- `source`: Where the subscription originated (e.g., "subscribe_page")

## API Endpoints

### POST /newsletter/subscribe

Subscribe to the newsletter. Idempotent - returns success even if already subscribed.

**Request Body:**
```json
{
  "email": "user@example.com",
  "source": "subscribe_page"
}
```

**Response (201 Created - new subscription):**
```json
{
  "subscribed": true,
  "email": "user@example.com"
}
```

**Response (200 OK - already subscribed):**
```json
{
  "subscribed": false,
  "email": "user@example.com"
}
```

## File Structure

### Backend (apps/vps)

```
src/
├── db/
│   └── newsletter.schema.ts      # Drizzle schema + zod validators
├── routes/
│   └── newsletter/
│       ├── newsletter.index.ts   # Router setup
│       ├── newsletter.routes.ts  # OpenAPI route definitions
│       └── newsletter.handlers.ts # Request handlers
└── app.ts                        # Route registration
```

### Frontend (apps/www)

```
src/
├── lib/
│   └── http.ts                   # useNewsletterSubscribe hook
└── routes/
    └── subscribe.tsx             # Subscribe page component
```

## Frontend Implementation

The subscribe page (`/subscribe`) features:
- Email input with validation
- Loading state during submission
- Success message differentiating new vs existing subscribers
- Error handling for failed requests

### Usage

```tsx
import { useNewsletterSubscribe } from '@/lib/http'

function SubscribeForm() {
  const { mutate, isPending, isSuccess, data } = useNewsletterSubscribe()
  
  const handleSubmit = (email: string) => {
    mutate({ email })
  }
  
  // ...
}
```

## Database Migration

Migration file: `drizzle/0022_wonderful_magik.sql`

Run migration:
```bash
cd apps/vps
bun db:migrate
```

## Future Enhancements

1. **Email Sending**: Integrate with SES to send welcome emails and newsletters
2. **Double Opt-in**: Add email confirmation flow for compliance
3. **Unsubscribe**: Add unsubscribe endpoint and link in emails
4. **Preferences**: Allow subscribers to choose notification types
5. **Admin UI**: Dashboard to view/manage subscribers
