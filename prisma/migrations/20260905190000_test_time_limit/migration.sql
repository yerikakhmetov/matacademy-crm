-- Ограничение по времени. Ответы сохраняются по ходу, поэтому закрытая вкладка
-- не оставляет ученика без результата.
ALTER TABLE "Test" ADD COLUMN "timeLimitMin" INTEGER;
ALTER TABLE "TestAttempt" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN "finished" BOOLEAN NOT NULL DEFAULT true;
