-- Незаполненные маски телефона из старой программы («+7 (7__) ___-__-__») — это «нет телефона».
-- Без этого все такие ученики считались братьями/сёстрами (одинаковый parentPhone) для скидки.
-- Трогаем только значения с подчёркиваниями и меньше чем 4 цифрами: частично набранные номера остаются.
UPDATE "Student" SET "phone" = NULL WHERE "phone" LIKE '%\_%' AND length(regexp_replace("phone", '\D', '', 'g')) < 4;
UPDATE "Student" SET "parentPhone" = NULL WHERE "parentPhone" LIKE '%\_%' AND length(regexp_replace("parentPhone", '\D', '', 'g')) < 4;
UPDATE "Teacher" SET "phone" = NULL WHERE "phone" LIKE '%\_%' AND length(regexp_replace("phone", '\D', '', 'g')) < 4;
UPDATE "Lead" SET "phone" = NULL WHERE "phone" LIKE '%\_%' AND length(regexp_replace("phone", '\D', '', 'g')) < 4;
