CREATE TABLE "PaymentItem" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PaymentItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentItem_paymentId_idx" ON "PaymentItem"("paymentId");
CREATE INDEX "PaymentItem_subjectId_idx" ON "PaymentItem"("subjectId");
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
