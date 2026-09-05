-- Частичные оплаты и возвраты: движения денег выносим в PaymentTx.
ALTER TABLE "Payment" ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PaymentTx" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PAYMENT',
  "amount" INTEGER NOT NULL,
  "method" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTx_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentTx_paymentId_idx" ON "PaymentTx"("paymentId");
CREATE INDEX "PaymentTx_date_idx" ON "PaymentTx"("date");

ALTER TABLE "PaymentTx" ADD CONSTRAINT "PaymentTx_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Перенос истории: каждый оплаченный счёт становится одним приходом с датой счёта,
-- поэтому доход по периодам не меняется.
INSERT INTO "PaymentTx" ("id", "paymentId", "kind", "amount", "method", "date", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || "id"),
  "id", 'PAYMENT', "amount", "method", "date", CURRENT_TIMESTAMP
FROM "Payment"
WHERE "status" = 'PAID' AND "amount" > 0;

UPDATE "Payment" SET "paidAmount" = "amount" WHERE "status" = 'PAID';
