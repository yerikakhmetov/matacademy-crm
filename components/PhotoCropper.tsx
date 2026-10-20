"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clampOffset, coverScale, sourceRect } from "@/lib/photo-crop";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

// Ученик ставит своё фото: выбирает файл, двигает и увеличивает его в квадратном окне,
// сохраняется ровно видимый квадрат 512×512 (JPEG). Загрузка — тот же /api/photo/upload.

const OUT = 512;

export function PhotoCropper({
  studentId,
  name,
  photoUrl,
  labels,
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
  labels: { change: string; hint: string; zoom: string; save: string; cancel: string; error: string };
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ dx: 0, dy: 0 });
  const [view, setView] = useState(280);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const router = useRouter();

  // окно обрезки помещается в экран телефона
  useEffect(() => {
    if (img) setView(Math.min(300, window.innerWidth - 72));
  }, [img]);

  const pick = (file: File) => {
    setError(null);
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setZoom(1);
      setOff({ dx: 0, dy: 0 });
    };
    i.onerror = () => window.alert(labels.error); // не картинка (или формат, который браузер не открывает)
    i.src = url;
  };

  const close = () => {
    if (img) URL.revokeObjectURL(img.src);
    setImg(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const setZoomClamped = (z: number) => {
    if (!img) return;
    setZoom(z);
    setOff((o) => clampOffset(img.naturalWidth, img.naturalHeight, view, z, o.dx, o.dy));
  };

  const save = async () => {
    if (!img) return;
    setPending(true);
    setError(null);
    try {
      const r = sourceRect(img.naturalWidth, img.naturalHeight, view, zoom, off.dx, off.dy);
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      canvas.getContext("2d")!.drawImage(img, r.sx, r.sy, r.size, r.size, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.88));
      const fd = new FormData();
      fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      fd.append("entity", "student");
      fd.append("id", studentId);
      const res = await fetch("/api/photo/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || labels.error);
      }
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : labels.error);
    } finally {
      setPending(false);
    }
  };

  const s = img ? coverScale(img.naturalWidth, img.naturalHeight, view, zoom) : 1;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={labels.change}
        title={labels.change}
        style={{ position: "relative", padding: 0, border: 0, background: "none", cursor: "pointer", flex: "none" }}
      >
        <Avatar name={name} photoUrl={photoUrl} size={52} radius={14} fontSize={18} />
        <span
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: "var(--accent)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            border: "2px solid var(--surface)",
          }}
        >
          <Icon name="edit" size={11} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
      />

      {img && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && !pending && close()}>
          <div className="modal" role="dialog" aria-label={labels.change} style={{ width: view + 48 }}>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
              <div style={{ fontWeight: 700, alignSelf: "stretch" }}>{labels.change}</div>
              <div
                style={{
                  width: view,
                  height: view,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 16,
                  background: "#000",
                  touchAction: "none",
                  cursor: "grab",
                }}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, dx: off.dx, dy: off.dy };
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d) return;
                  setOff(clampOffset(img.naturalWidth, img.naturalHeight, view, zoom, d.dx + e.clientX - d.x, d.dy + e.clientY - d.y));
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onWheel={(e) => setZoomClamped(Math.min(3, Math.max(1, zoom - e.deltaY / 500)))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: img.naturalWidth * s,
                    height: img.naturalHeight * s,
                    maxWidth: "none",
                    transform: `translate(calc(-50% + ${off.dx}px), calc(-50% + ${off.dy}px))`,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              </div>
              <p className="mut" style={{ fontSize: 12.5, margin: 0, textAlign: "center" }}>{labels.hint}</p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "stretch", fontSize: 13 }}>
                <span className="mut">{labels.zoom}</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoomClamped(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </label>
              {error && <span role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>{error}</span>}
              <div style={{ display: "flex", gap: 8, alignSelf: "stretch", justifyContent: "flex-end" }}>
                <button type="button" className="btn ghost" disabled={pending} onClick={close}>{labels.cancel}</button>
                <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? "…" : labels.save}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
