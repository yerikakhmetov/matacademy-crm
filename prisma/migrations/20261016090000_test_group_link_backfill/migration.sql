-- Импорт тестов создавал тест с основной группой (groupId), но без привязки TestGroup,
-- а кабинет ученика показывает тесты только по привязкам — импортированные тесты были
-- не видны ученикам. Добавляем недостающую привязку основной группы.
INSERT INTO "TestGroup" ("testId", "groupId")
SELECT t."id", t."groupId"
FROM "Test" t
WHERE t."groupId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "TestGroup" tg WHERE tg."testId" = t."id" AND tg."groupId" = t."groupId"
  );
