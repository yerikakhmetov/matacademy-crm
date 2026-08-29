import { initials, avatarColor } from "@/lib/format";

// Аватар: фото если есть, иначе инициалы на цветном фоне.
export function Avatar({
  name,
  photoUrl,
  size = 34,
  radius = 9,
  fontSize,
  bg,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  radius?: number;
  fontSize?: number;
  bg?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flex: "none", display: "block" }}
      />
    );
  }
  return (
    <div
      className="av2"
      style={{ width: size, height: size, borderRadius: radius, background: bg || avatarColor(name), fontSize: fontSize ?? Math.round(size * 0.38) }}
    >
      {initials(name)}
    </div>
  );
}
