CREATE TABLE "Material" (
  "id" TEXT NOT NULL,
  "groupId" TEXT,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL DEFAULT '',
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Material_groupId_idx" ON "Material"("groupId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
