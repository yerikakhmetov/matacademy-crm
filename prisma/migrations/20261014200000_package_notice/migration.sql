-- Отправленные напоминания «заканчиваются оплаченные занятия»: одно на каждую оплату (total).
CREATE TABLE "PackageNotice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageNotice_studentId_subjectId_total_key" ON "PackageNotice"("studentId", "subjectId", "total");
