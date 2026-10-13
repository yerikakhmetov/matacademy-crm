-- Вход через Telegram с подтверждением в боте: показываем устройство и ждём «Да, это я».
ALTER TABLE "LoginToken" ADD COLUMN "pendingUserId" TEXT;
ALTER TABLE "LoginToken" ADD COLUMN "device" TEXT;
