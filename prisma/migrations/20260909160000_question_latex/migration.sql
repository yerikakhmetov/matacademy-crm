-- Исходник вопроса в LaTeX: формулы показываем набором, а не строкой «3/10».
-- text/options остаются читаемым текстом и служат запасным вариантом.
ALTER TABLE "TestQuestion" ADD COLUMN "textTex" TEXT;
ALTER TABLE "TestQuestion" ADD COLUMN "optionsTex" TEXT[] DEFAULT ARRAY[]::TEXT[];
