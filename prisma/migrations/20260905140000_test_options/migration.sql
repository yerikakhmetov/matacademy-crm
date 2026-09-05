-- Параметры теста: перемешивание вопросов и повторное прохождение.
ALTER TABLE "Test" ADD COLUMN "shuffle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Test" ADD COLUMN "allowRetake" BOOLEAN NOT NULL DEFAULT false;
