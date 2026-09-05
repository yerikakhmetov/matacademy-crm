import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { logout } from "@/app/actions/auth";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/dashboard");
  const settings = await getSettings();
  const locale = await getLocale();

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
        }}
      >
        <div className="logo" style={{ width: 34, height: 34, flex: "none" }}>
          <Icon name="book" size={18} style={{ color: "#fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>{settings.schoolName}</div>
          <div className="mut" style={{ fontSize: 11.5 }}>{t(locale, "lms.studentCabinet")}</div>
        </div>
        <LocaleSwitcher current={locale} path="/cabinet" />
        <span className="mut" style={{ fontSize: 12.5, fontWeight: 600 }}>{session.user.name}</span>
        <form action={logout}>
          <button className="icon-btn" title={t(locale, "common.logout")} type="submit">
            <Icon name="logout" size={16} />
          </button>
        </form>
      </header>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "18px 16px 48px" }}>{children}</main>
    </div>
  );
}
