import Image from "next/image";

// Логотип школы. Круглый знак «M» читается и на светлой, и на тёмной теме,
// поэтому идёт везде, где мало места (вход, кабинет ученика, квитанция).
// Горизонтальный логотип — в боковом меню (там всегда тёмный фон, светлый вариант).
export function BrandMark({ size = 40 }: { size?: number }) {
  return <Image src="/brand/badge.png" alt="MatAcademy" width={size} height={size} style={{ flex: "none" }} priority />;
}

export function BrandWordmark({ width = 168, light = false }: { width?: number; light?: boolean }) {
  // пропорции файлов public/brand/logo*.png — 640 × 164
  return (
    <Image
      src={light ? "/brand/logo-light.png" : "/brand/logo.png"}
      alt="MatAcademy"
      width={width}
      height={Math.round((width * 164) / 640)}
      priority
    />
  );
}
