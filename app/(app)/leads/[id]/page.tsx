import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { avatarColor, initials, formatDate, ACTIVITY_TYPE } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ModalButton } from "@/components/ModalButton";
import { LeadStageBar } from "./LeadStageBar";
import { AddActivity } from "./AddActivity";
import { LeadTaskToggle } from "./LeadTaskToggle";
import { ConvertForm } from "./ConvertForm";
import { convertLeadToStudent } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const editor = canEdit(session?.user?.role);

  const [lead, groups] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { activities: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!lead) notFound();

  const isWon = lead.stage === "WON";

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/leads" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <div className="av2" style={{ background: avatarColor(lead.name), width: 52, height: 52, fontSize: 18, borderRadius: 12 }}>
            {initials(lead.name)}
          </div>
          <div>
            <h1 style={{ fontSize: 22 }}>{lead.name}</h1>
            <p>
              {lead.childName ? `Ребёнок: ${lead.childName} · ` : ""}
              {lead.grade ?? "—"}
              {lead.subject ? ` · ${lead.subject}` : ""}
            </p>
          </div>
        </div>
        {editor && !isWon && (
          <ModalButton
            label="Перевести в ученики"
            title="Перевод лида в ученики"
            icon="students"
            submitLabel="Создать ученика"
            action={convertLeadToStudent.bind(null, lead.id)}
          >
            <ConvertForm groups={groups} defaultName={lead.childName ?? lead.name} defaultGrade={lead.grade ?? ""} />
          </ModalButton>
        )}
        {isWon && (
          <span className="chip c-ok" style={{ padding: "8px 14px" }}>
            <span className="d" />
            Оплатили
          </span>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">
            <h3>Активности</h3>
            <span className="chip c-mut">
              <span className="d" />
              {lead.activities.length}
            </span>
          </div>

          <div style={{ padding: "6px 0" }}>
            {lead.activities.length === 0 && <div className="empty">Пока нет звонков и задач — добавьте первую активность</div>}
            {lead.activities.map((a) => {
              const t = ACTIVITY_TYPE[a.type] ?? ACTIVITY_TYPE.NOTE;
              return (
                <div className="list-row" key={a.id}>
                  <div className="pay-ico" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                    <Icon name={t.icon} size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, textDecoration: a.done ? "line-through" : "none", opacity: a.done ? 0.6 : 1 }}>
                      {a.text}
                    </div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {t.label} · {formatDate(a.createdAt)}
                      {a.dueDate ? ` · срок: ${formatDate(a.dueDate)}` : ""}
                    </div>
                  </div>
                  {a.type === "TASK" && editor && <LeadTaskToggle id={a.id} done={a.done} />}
                </div>
              );
            })}
          </div>

          {editor && <AddActivity leadId={lead.id} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <h3>Этап воронки</h3>
            </div>
            <div style={{ padding: 18 }}>
              <LeadStageBar leadId={lead.id} current={lead.stage} editor={editor} />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Контакты</h3>
            </div>
            <div style={{ padding: 18 }}>
              <dl className="dl">
                <dt>Контакт</dt>
                <dd>{lead.name}</dd>
                <dt>Телефон</dt>
                <dd>{lead.phone ?? "—"}</dd>
                <dt>Ребёнок</dt>
                <dd>{lead.childName ?? "—"}</dd>
                <dt>Класс</dt>
                <dd>{lead.grade ?? "—"}</dd>
                <dt>Интерес</dt>
                <dd>{lead.subject ?? "—"}</dd>
                <dt>Источник</dt>
                <dd>{lead.source ?? "—"}</dd>
                <dt>Создан</dt>
                <dd>{formatDate(lead.createdAt)}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
