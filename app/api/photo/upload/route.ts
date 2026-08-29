import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Выдаёт клиенту токен для прямой загрузки фото в Vercel Blob.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        // загружать могут админ/менеджер и преподаватель (для своего фото)
        if (!session?.user || (!canEdit(session.user.role) && session.user.role !== "TEACHER")) {
          throw new Error("Недостаточно прав");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        /* URL сохраняем на клиенте после upload() */
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 400 });
  }
}
