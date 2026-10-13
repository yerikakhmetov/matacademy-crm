-- Ставка куратора на группу: ₸ с каждого оплатившего ученика группы в месяц (0 = ставка предмета/общая).
ALTER TABLE "Group" ADD COLUMN "curatorRate" INTEGER NOT NULL DEFAULT 0;
