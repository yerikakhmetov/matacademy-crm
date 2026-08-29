import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Проверяет, подтвердил ли преподаватель вход в боте (userId проставлен вебхуком).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ ready: false });
  const lt = await prisma.loginToken.findUnique({ where: { token }, select: { userId: true } });
  return NextResponse.json({ ready: !!lt?.userId });
}
