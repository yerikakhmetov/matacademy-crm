import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Веб-манифест: ученик может добавить кабинет на домашний экран телефона
// и открывать его как приложение, без магазина и установки.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();
  return {
    name: settings.schoolName,
    short_name: settings.schoolName,
    description: "Личный кабинет ученика: расписание, домашние задания, оценки и тесты",
    // Ученика открывает кабинет; сотрудника с этого адреса перебросит на его раздел
    start_url: "/cabinet",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F8FB",
    theme_color: "#3A5AE0",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
