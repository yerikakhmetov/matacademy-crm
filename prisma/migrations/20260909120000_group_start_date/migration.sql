-- Дата начала занятий группы. До неё занятий по расписанию не существует.
ALTER TABLE "Group" ADD COLUMN "startDate" TIMESTAMP(3);
