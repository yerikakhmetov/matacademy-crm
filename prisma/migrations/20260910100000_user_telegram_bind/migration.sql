-- Одноразовый код привязки Telegram к учётной записи (админ, менеджер, куратор).
ALTER TABLE "User" ADD COLUMN "tgBindToken" TEXT;
ALTER TABLE "User" ADD COLUMN "tgBindIssued" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_tgBindToken_key" ON "User"("tgBindToken");
