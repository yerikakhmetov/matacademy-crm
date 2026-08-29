"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { savePhotoUrl, removePhoto } from "@/app/actions/data";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

// Уменьшает изображение до maxSize по большей стороне, возвращает JPEG Blob.
async function resizeImage(file: File, maxSize = 512): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export function PhotoUpload({
  entity,
  id,
  name,
  photoUrl,
  size = 72,
}: {
  entity: "student" | "teacher";
  id: string;
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onFile = async (file: File) => {
    setError(null);
    setPending(true);
    try {
      const blob = await resizeImage(file);
      const result = await upload(`${entity}/${id}-${Date.now()}.jpg`, blob, {
        access: "public",
        handleUploadUrl: "/api/photo/upload",
        contentType: "image/jpeg",
      });
      await savePhotoUrl(entity, id, result.url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setPending(false);
    }
  };

  const onRemove = async () => {
    setError(null);
    setPending(true);
    try {
      await removePhoto(entity, id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Avatar name={name} photoUrl={photoUrl} size={size} radius={14} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" type="button" disabled={pending} onClick={() => inputRef.current?.click()} style={{ padding: "7px 13px", fontSize: 13 }}>
            <Icon name="edit" size={14} />
            {pending ? "Загрузка…" : photoUrl ? "Заменить фото" : "Загрузить фото"}
          </button>
          {photoUrl && (
            <button className="btn ghost" type="button" disabled={pending} onClick={onRemove} style={{ padding: "7px 13px", fontSize: 13, color: "var(--bad)" }}>
              Удалить
            </button>
          )}
        </div>
        {error && <span className="chip c-bad" style={{ fontSize: 11.5 }}><span className="d" />{error}</span>}
      </div>
    </div>
  );
}
