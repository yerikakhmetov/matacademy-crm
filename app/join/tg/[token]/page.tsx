import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { TgLogin } from "./TgLogin";

export const dynamic = "force-dynamic";

// Вход ученика по кнопке из Telegram: токен одноразовый и живёт 10 минут,
// проверяет его провайдер "telegram" в auth.ts.
export default async function TgLoginPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ padding: 24, maxWidth: 380, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 18, marginBottom: 6 }}>{t(locale, "join.signingIn")}</h1>
        <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>{t(locale, "join.signingInHint")}</p>
        <TgLogin token={token} locale={locale} />
      </div>
    </div>
  );
}
