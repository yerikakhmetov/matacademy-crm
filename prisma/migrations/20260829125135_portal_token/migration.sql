ALTER TABLE "Student" ADD COLUMN "portalToken" TEXT;
CREATE UNIQUE INDEX "Student_portalToken_key" ON "Student"("portalToken");
