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
import { createSubject, updateSubject } from "@/app/actions/subjects";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const editor = await canEditData(session?.user?.role);

  const [subjects, settings] = await Promise.all([
    prisma.subject.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { payItems: true, tests: true } },
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
          <p>{subjects.filter((s) => s.active).length} активных предметов · цены и доли для счетов</p>
        </div>
        {editor && (
          <ModalButton label="Предмет" title="Новый предмет" action={createSubject}>
            <SubjectForm />
          </ModalButton>
        )}
      </div>

      {subjects.some((s) => s.active && s.lessonsPerMonth <= 0) && (
        <div className="card" role="alert" style={{ padding: "12px 16px", marginBottom: 16, borderColor: "var(--warn)" }}>
          <b>У части предметов не указано число занятий в месяце.</b>{" "}
          <span className="mut">
            Пакет для них считается как 12 занятий. Если предмет обязательный (8 занятий), преподавателю за занятие
            начисляется меньше — откройте предмет и укажите число занятий.
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table {...cardCols(["Предмет", "Цена / месяц", "Занятий", "За занятие", "Ставка педагога", "Ставка куратора", "Статус", "В счетах", editor && ""])}>
            <thead>
              <tr>
                <th>Предмет</th>
                <th className="right">Цена / месяц</th>
                <th className="right">Занятий</th>
                <th className="right">За занятие</th>
                <th className="right">Ставка педагога</th>
                <th className="right">Ставка куратора</th>
                <th>Статус</th>
                <th className="right">В счетах</th>
                {editor && <th style={{ width: 220 }}></th>}
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={editor ? 9 : 8}>
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
                  <td className="right num">
                    {s.lessonsPerMonth > 0 ? (
                      s.lessonsPerMonth
                    ) : (
                      // без числа занятий пакет считается как 12 — для обязательного предмета это неверно
                      <span className="chip c-warn" title="Не задано: пакет считается как 12 занятий. Обязательному предмету укажите 8.">
                        <span className="d" />не задано
                      </span>
                    )}
                  </td>
                  <td className="right num mut">
                    {s.lessonsPerMonth > 0 ? money(Math.round(s.price / s.lessonsPerMonth)) : "—"}
                  </td>
                  <td className="right num">
                    {s.teacherRate > 0 ? (
                      <span>
                        <span style={{ fontWeight: 600 }}>{money(s.teacherRate)}</span>
                        <span className="mut"> / {s.teacherRateLessons} зан.</span>
                      </span>
                    ) : (
                      <span className="mut" title="Зарплата считается по доле ученика">по доле</span>
                    )}
                  </td>
                  <td className="right num">
                    {s.curatorRate > 0 ? (
                      <span style={{ fontWeight: 600 }}>{money(s.curatorRate)}</span>
                    ) : (
                      <span className="mut" title="Общая ставка куратора из настроек">{money(settings.curatorRate)} общая</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${s.active ? "c-ok" : "c-mut"}`}>
                      <span className="d" />
                      {s.active ? "Активен" : "Скрыт"}
                    </span>
                  </td>
                  <td className="right num">{s._count.payItems}</td>
                  {editor && (
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <ModalButton label="Изменить" title={`Предмет · ${s.name}`} icon="edit" buttonClass="btn ghost" action={updateSubject.bind(null, s.id)}>
                          <SubjectForm values={s} />
                        </ModalButton>
                        <DeleteSubjectButton id={s.id} name={s.name} used={s._count.payItems > 0} />
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
