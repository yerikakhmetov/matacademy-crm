-- Куратор группы: следит за посещаемостью и журналом своих групп.
ALTER TABLE "Group" ADD COLUMN "curatorId" TEXT;
CREATE INDEX "Group_curatorId_idx" ON "Group"("curatorId");
ALTER TABLE "Group" ADD CONSTRAINT "Group_curatorId_fkey"
  FOREIGN KEY ("curatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
