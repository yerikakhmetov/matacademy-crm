-- Ссылка-приглашение в кабинет больше не использует id ученика.
-- Отдельный перевыпускаемый токен + закрепление за первым Telegram-аккаунтом.
ALTER TABLE "Student" ADD COLUMN "joinToken" TEXT;
ALTER TABLE "Student" ADD COLUMN "joinTgId" TEXT;

-- Выдать токен всем существующим ученикам (32 hex — как newToken()).
UPDATE "Student"
SET "joinToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "joinToken" IS NULL;

CREATE UNIQUE INDEX "Student_joinToken_key" ON "Student"("joinToken");
