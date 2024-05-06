import * as Sentry from '@sentry/nextjs'

export default function handler(_req, res) {
  try {
    throw new Error("now it will show up in the dashboard");
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: "Its me. not you." });
  }
}