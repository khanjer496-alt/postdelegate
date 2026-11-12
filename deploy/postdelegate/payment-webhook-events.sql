-- Apply before releasing the webhook handler. No existing rows are changed.
CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "claimToken" TEXT NOT NULL,
  "claimUntil" TIMESTAMP(3),
  PRIMARY KEY ("provider", "eventId")
);
