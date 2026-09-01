CREATE TABLE "PayrollRecord" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "rate" INTEGER NOT NULL,
  "rateType" TEXT NOT NULL,
  "base" INTEGER NOT NULL,
  "salary" INTEGER NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollRecord_teacherId_year_month_key" ON "PayrollRecord"("teacherId", "year", "month");
CREATE INDEX "PayrollRecord_year_month_idx" ON "PayrollRecord"("year", "month");
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
