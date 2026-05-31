# Reminder Status Locking

To prevent duplicate reminder emails being sent (even if multiple instances of the processor are running or if runs overlap), we transitioned from a simple `isSent` boolean to a robust status-based state machine.

## Database Schema

We added a `reminder_status` enum and a `status` column to the `music_reminder` table.

```typescript
export const reminderStatusEnum = pgEnum('reminder_status', [
  'pending',
  'processing',
  'sent',
  'failed'
])
```

## Atomic Claiming Mechanism

The processor uses an atomic `UPDATE ... RETURNING` query to "claim" reminders that are due. This is a classic pattern for distributed task processing.

### The Query

The processor searches for reminders where:

1.  `reminderDate` is in the past.
2.  `status` is `pending`, `failed`, or `processing` but stalled (updated more than 5 minutes ago).

```typescript
db.update(musicReminder)
  .set({
    status: 'processing',
    updatedAt: new Date()
  })
  .where(
    and(
      lte(musicReminder.reminderDate, now),
      or(
        eq(musicReminder.status, 'pending'),
        and(eq(musicReminder.status, 'processing'), lte(musicReminder.updatedAt, fiveMinutesAgo)),
        eq(musicReminder.status, 'failed')
      )
    )
  )
  .returning()
```

The database ensures that only one process can successfully update and "return" a specific record, effectively locking it.

## State Transitions

- **Pending → Processing**: Atomic claim at the start of the batch.
- **Processing → Sent**: Marked on successful email delivery.
- **Processing → Failed**: Marked if the email delivery or associated logic fails.
- **Stalled Recovery**: If a process crashes while a reminder is in the `processing` state, it will be automatically picked up by the next run after 5 minutes (via the `updatedAt` check).

## Monitoring

The `getReminderStats` function was updated to include a `processing` count, allowing us to monitor how many reminders are currently being handled by the system.
