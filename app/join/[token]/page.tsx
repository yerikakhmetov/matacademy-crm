import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { StudentJoin } from "./StudentJoin";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [student, settings] = await Promise.all([
    prisma.student.findUnique({ where: { joinToken: token }, select: { name: true } }),
    getSettings(),
  ]);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? null;
  const locale = await getLocale();

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="logo" style={{ width: 52, height: 52, margin: "0 auto 14px" }}>
          <Icon name="book" size={26} style={{ color: "#fff" }} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{settings.schoolName}</h1>
        <div style={{ margin: "0 0 14px" }}>
          <LocaleSwitcher current={locale} path={`/join/${token}`} />
        </div>
        {student ? (
          <>
            <p className="mut" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
              {t(locale, "join.cabinetOf", { name: student.name })}
            </p>
            <StudentJoin joinToken={token} botUsername={botUsername} locale={locale} />
            <p className="mut" style={{ fontSize: 11.5, marginTop: 16 }}>
              {t(locale, "join.onlyTelegram")}
            </p>
          </>
        ) : (
          <p className="mut" style={{ fontSize: 13.5, marginTop: 12 }}>
            {t(locale, "join.invalidLink")}
          </p>
        )}
      </div>
    </div>
  );
}
