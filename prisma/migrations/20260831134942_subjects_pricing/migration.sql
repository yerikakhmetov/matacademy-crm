-- Предметы
CREATE TABLE "Subject" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT NOT NULL DEFAULT '#3A5AE0',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- Абонемент: поля скидок
ALTER TABLE "Subscription" ADD COLUMN "basePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "discountName" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "discountPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "multiPct" INTEGER NOT NULL DEFAULT 0;

-- Позиции абонемента по предметам
CREATE TABLE "SubscriptionItem" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT NOT NULL,
  "base" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SubscriptionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionItem_subscriptionId_idx" ON "SubscriptionItem"("subscriptionId");
CREATE INDEX "SubscriptionItem_subjectId_idx" ON "SubscriptionItem"("subjectId");
ALTER TABLE "SubscriptionItem" ADD CONSTRAINT "SubscriptionItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionItem" ADD CONSTRAINT "SubscriptionItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Настройки: скидки
ALTER TABLE "Settings" ADD COLUMN "discounts" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "multiDiscount" TEXT NOT NULL DEFAULT '';
