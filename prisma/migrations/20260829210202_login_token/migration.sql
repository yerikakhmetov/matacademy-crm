CREATE TABLE "LoginToken" (
  "token" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("token")
);
