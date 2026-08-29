ALTER TABLE "User" ADD COLUMN "telegramUserId" TEXT;
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
