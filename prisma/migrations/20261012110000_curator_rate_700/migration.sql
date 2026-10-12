-- Ставка куратора 700 ₸ для Математической грамотности и Истории Казахстана
-- (у остальных предметов — общая ставка из настроек, 1000 ₸).
UPDATE "Subject"
SET "curatorRate" = 700
WHERE "curatorRate" = 0
  AND (
    "name" ILIKE '%сауат%'
    OR "name" ILIKE '%грамотн%'
    OR "name" ILIKE '%тарих%'
    OR "name" ILIKE '%истори%'
  );
