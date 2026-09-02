-- Гибкий прайсинг: правило объединения скидок, скидка «брат/сестра», персональная скидка ученика.
ALTER TABLE "Settings" ADD COLUMN "discountMode" TEXT NOT NULL DEFAULT 'add';
ALTER TABLE "Settings" ADD COLUMN "siblingDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "personalDiscount" INTEGER NOT NULL DEFAULT 0;
