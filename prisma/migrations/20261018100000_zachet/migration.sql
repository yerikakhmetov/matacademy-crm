-- Зачёты: куратор назначает группе зачёт и отмечает учеников «сдал/не сдал».
CREATE TABLE "Zachet" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Zachet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Zachet_groupId_scheduledAt_idx" ON "Zachet"("groupId", "scheduledAt");
ALTER TABLE "Zachet" ADD CONSTRAINT "Zachet_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ZachetResult" (
    "id" TEXT NOT NULL,
    "zachetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "comment" TEXT,
    "markedBy" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ZachetResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ZachetResult_zachetId_studentId_key" ON "ZachetResult"("zachetId", "studentId");
CREATE INDEX "ZachetResult_studentId_idx" ON "ZachetResult"("studentId");
ALTER TABLE "ZachetResult" ADD CONSTRAINT "ZachetResult_zachetId_fkey" FOREIGN KEY ("zachetId") REFERENCES "Zachet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZachetResult" ADD CONSTRAINT "ZachetResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
