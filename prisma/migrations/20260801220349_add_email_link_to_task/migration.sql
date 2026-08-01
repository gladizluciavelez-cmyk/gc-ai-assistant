-- AlterTable
ALTER TABLE "TaskItem" ADD COLUMN     "emailId" TEXT;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "EmailRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
