-- Зарплата по посещаемости: уважительная причина отсутствия + удержание школы, %.
ALTER TABLE "Attendance" ADD COLUMN "excused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "schoolFeePct" INTEGER NOT NULL DEFAULT 3;
