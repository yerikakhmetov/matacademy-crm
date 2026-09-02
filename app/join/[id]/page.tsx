import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { StudentJoin } from "./StudentJoin";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, settings] = await Promise.all([
    prisma.student.findUnique({ where: { id }, select: { name: true } }),
    getSettings(),
  ]);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="logo" style={{ width: 52, height: 52, margin: "0 auto 14px" }}>
          <Icon name="book" size={26} style={{ color: "#fff" }} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{settings.schoolName}</h1>
        {student ? (
          <>
            <p className="mut" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
              Личный кабинет ученика: <b>{student.name}</b>
            </p>
            <StudentJoin studentId={id} botUsername={botUsername} />
            <p className="mut" style={{ fontSize: 11.5, marginTop: 16 }}>
              Вход только через Telegram. Ссылка персональная — не передавайте её другим.
            </p>
          </>
        ) : (
          <p className="mut" style={{ fontSize: 13.5, marginTop: 12 }}>
            Ссылка недействительна. Попросите у школы новую ссылку-приглашение.
          </p>
        )}
      </div>
    </div>
  );
}
