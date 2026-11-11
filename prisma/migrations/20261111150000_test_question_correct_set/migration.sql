-- Вопрос с несколькими верными вариантами: все индексы верных. Пусто — обычный вопрос с одним (correct).
ALTER TABLE "TestQuestion" ADD COLUMN "correctSet" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
