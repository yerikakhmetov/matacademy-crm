ALTER TABLE "Group" ADD COLUMN "subjectId" TEXT;
CREATE INDEX "Group_subjectId_idx" ON "Group"("subjectId");
ALTER TABLE "Group" ADD CONSTRAINT "Group_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
