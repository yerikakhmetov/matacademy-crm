-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "schoolName" TEXT NOT NULL DEFAULT 'МатАкадемия',
    "address" TEXT NOT NULL DEFAULT 'г. Алматы, ул. Абая',
    "branches" TEXT NOT NULL DEFAULT 'Абая',
    "rooms" TEXT NOT NULL DEFAULT 'Каб. 1, Каб. 2, Каб. 3',
    "tariffs" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
