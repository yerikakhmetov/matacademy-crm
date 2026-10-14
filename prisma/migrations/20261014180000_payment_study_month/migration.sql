-- Номер месяца обучения (пакета занятий), с которого начинается счёт. NULL — старый календарный счёт.
ALTER TABLE "Payment" ADD COLUMN "studyMonth" INTEGER;
