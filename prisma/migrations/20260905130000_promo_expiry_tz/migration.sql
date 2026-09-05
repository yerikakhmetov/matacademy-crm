-- Срок действия промокода и часовой пояс школы (вместо зашитого UTC+5).
ALTER TABLE "PromoCode" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Settings" ADD COLUMN "tzOffsetHours" INTEGER NOT NULL DEFAULT 5;
