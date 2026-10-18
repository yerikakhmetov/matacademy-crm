import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isCuratorOfGroup } from "@/lib/curator";
import { getSettings } from "@/lib/settings";
import { schoolClock } from "@/lib/school-time";
import { utcToSchoolParts, zachetSummary } from "@/lib/zachet";
import { Avatar } from "@/components/Avatar";
import { ModalButton } from "@/components/ModalButton";
import { updateZachet } from "@/app/actions/zachets";
import { ZachetForm } from "../ZachetForm";
import { ZachetResultButtons } from "../ZachetResultButtons";
import { DeleteZachetButton } from "./DeleteZachetButton";

export const dynamic = "force-dynamic";

// Зачёт группы: куратор отмечает каждого ученика «сдал / не сдал».
export default async function ZachetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const z = await prisma.zachet.findUnique({
    where: { id },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
          students: { where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } },
        },
      },
      results: { select: { studentId: true, passed: true, markedBy: true } },
    },
  });
  if (!z) notFound();
  const allowed = (await canEditData(session?.user?.role)) || (await isCuratorOfGroup(session?.user?.id, z.groupId));
  if (!allowed) redirect("/zachets");

  const tz = (await getSettings()).tzOffsetHours;
  const p = utcToSchoolParts(z.scheduledAt, tz);
  const result = new Map(z.results.map((r) => [r.studentId, r]));
  const s = zachetSummary(z.group.students.map((x) => x.id), z.results);
  const started = z.scheduledAt.getTime() <= Date.now();

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/zachets" className="mut" style={{ fontSize: 12.5 }}>← Все зачёты</Link>
          <h1 style={{ marginTop: 4 }}>{z.topic}</h1>
          <p>
            {z.group.name} · {p.date.slice(8, 10)}.{p.date.slice(5, 7)}.{p.date.slice(0, 4)} в {p.time}
            {z.note ? ` · ${z.note}` : ""}
          </p>
        </div>
        <ModalButton label="Изменить" title="Зачёт" icon="edit" buttonClass="btn ghost" action={updateZachet.bind(null, z.id)}>
          <ZachetForm values={{ topic: z.topic, date: p.date, time: p.time, note: z.note }} defaultDate={schoolClock(tz).toISOString().slice(0, 10)} />
        </ModalButton>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Ученики</h3>
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <span className="chip c-ok"><span className="d" />сдали {s.passed}</span>
            <span className="chip c-bad"><span className="d" />не сдали {s.failed}</span>
            {s.unmarked > 0 && (
              <span className={`chip ${started ? "c-warn" : "c-mut"}`}><span className="d" />не отмечено {s.unmarked}</span>
            )}
          </span>
        </div>
        <div style={{ padding: "6px 0" }}>
          {z.group.students.length === 0 && <div className="empty">В группе нет учеников</div>}
          {z.group.students.map((st) => (
            <div key={st.id} className="list-row" style={{ flexWrap: "wrap", gap: 10 }}>
              <Avatar name={st.name} photoUrl={st.photoUrl} size={30} radius={9} fontSize={11} />
              <div style={{ flex: 1, minWidth: 140, fontWeight: 600 }}>{st.name}</div>
              <ZachetResultButtons zachetId={z.id} studentId={st.id} passed={result.get(st.id)?.passed ?? null} />
            </div>
          ))}
        </div>
        <p className="mut" style={{ fontSize: 12, padding: "0 18px 14px", margin: 0 }}>
          Отметка сразу видна родителю в его портале и ученику в кабинете. Повторный клик по выбранной кнопке снимает отметку.
        </p>
      </div>

      <DeleteZachetButton id={z.id} />
    </>
  );
}
