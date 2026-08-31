import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money } from "@/lib/format";
import { getSettings, parseDiscounts, parseMultiTiers } from "@/lib/settings";
import { ModalButton } from "@/components/ModalButton";
import { SubjectForm } from "./SubjectForm";
import { DeleteSubjectButton } from "./DeleteSubjectButton";
import { createSubject, updateSubject } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const editor = await canEditData(session?.user?.role);

  const [subjects, settings] = await Promise.all([
    prisma.subject.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { items: true, tests: true } },
        groups: { select: { id: true } },
        teachers: { select: { id: true, name: true } },
      },
    }),
    getSettings(),
  ]);
  const discounts = parseDiscounts(settings.discounts);
  const tiers = parseMultiTiers(settings.multiDiscount);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Предметы и цены</h1>
          <p>{subjects.filter((s) => s.active).length} активных предметов · цены и доли для абонементов</p>
        </div>
        {editor && (
          <ModalButton label="Предмет" title="Новый предмет" action={createSubject}>
            <SubjectForm />
          </ModalButton>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Предмет</th>
                <th className="right">Цена / месяц</th>
                <th>Статус</th>
                <th className="right">В абонементах</th>
                {editor && <th style={{ width: 220 }}></th>}
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={editor ? 5 : 4}>
                    <div className="empty">Предметов пока нет — добавьте первый</div>
                  </td>
                </tr>
              )}
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 4, background: s.color, flex: "none" }} />
                      {s.name}
                    </span>
                    {(s.groups.length > 0 || s.teachers.length > 0 || s._count.tests > 0) && (
                      <div className="mut" style={{ fontSize: 11.5, marginTop: 3, paddingLeft: 22 }}>
                        {s.groups.length} групп · {s.teachers.map((t) => t.name).join(", ") || "нет преподавателей"}
                        {s._count.tests > 0 ? ` · ${s._count.tests} тестов` : ""}
                      </div>
                    )}
                  </td>
                  <td className="right num" style={{ fontWeight: 700 }}>{money(s.price)}</td>
                  <td>
                    <span className={`chip ${s.active ? "c-ok" : "c-mut"}`}>
                      <span className="d" />
                      {s.active ? "Активен" : "Скрыт"}
                    </span>
                  </td>
                  <td className="right num">{s._count.items}</td>
                  {editor && (
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <ModalButton label="Изменить" title={`Предмет · ${s.name}`} icon="edit" buttonClass="btn ghost" action={updateSubject.bind(null, s.id)}>
                          <SubjectForm values={s} />
                        </ModalButton>
                        <DeleteSubjectButton id={s.id} name={s.name} used={s._count.items > 0} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">
            <h3>Спец-скидки</h3>
          </div>
          <div style={{ padding: "6px 0" }}>
            {discounts.length === 0 && <div className="empty">Не заданы — добавьте в «Настройках»</div>}
            {discounts.map((d) => (
              <div className="list-row" key={d.name}>
                <div style={{ flex: 1, fontWeight: 600 }}>{d.name}</div>
                <span className="chip c-acc"><span className="d" />−{d.percent}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Скидка за несколько предметов</h3>
          </div>
          <div style={{ padding: "6px 0" }}>
            {tiers.length === 0 && <div className="empty">Не задана — добавьте в «Настройках»</div>}
            {tiers.map((t) => (
              <div className="list-row" key={t.count}>
                <div style={{ flex: 1, fontWeight: 600 }}>от {t.count} предметов</div>
                <span className="chip c-vio"><span className="d" />−{t.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
