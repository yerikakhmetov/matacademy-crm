-- Расходы школы: без них «прибыль» в отчётах была завышена (учитывалась только зарплата).
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "title" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_date_idx" ON "Expense"("date");
