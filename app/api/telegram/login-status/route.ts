import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { describeDevice, isLoginToken } from "@/lib/device";

export const dynamic = "force-dynamic";

// Опрос со страницы входа: подтвердил ли человек вход в боте (userId проставлен).
// При первом опросе запоминаем устройство — бот покажет его в вопросе «Это вы?».
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!isLoginToken(token)) return NextResponse.json({ ready: false });

  const lt = await prisma.loginToken.findUnique({ where: { token }, select: { userId: true, device: true } });
  if (!lt) {
    const device = describeDevice(
      req.headers.get("user-agent"),
      req.headers.get("x-vercel-ip-city"),
      (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null
    );
    await prisma.loginToken.upsert({ where: { token }, create: { token, device }, update: {} }).catch(() => {});
    return NextResponse.json({ ready: false });
  }
  return NextResponse.json({ ready: !!lt.userId });
}
