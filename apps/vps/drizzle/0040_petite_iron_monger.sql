ALTER TABLE "audio" ADD COLUMN "idempotencyKey" uuid;--> statement-breakpoint
ALTER TABLE "audio" ADD COLUMN "idempotencyActorId" text;--> statement-breakpoint
CREATE UNIQUE INDEX "audio_type_slug_unique" ON "audio" USING btree ("type","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_actor_idempotency_unique" ON "audio" USING btree ("idempotencyActorId","idempotencyKey");