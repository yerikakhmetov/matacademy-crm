import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { cardCols } from "@/lib/card-table";
import { localDigits } from "@/lib/phone";
import { clearCareerLink } from "@/app/actions/career";
import { CareerImportForm } from "./CareerImportForm";

export const dynamic = "force-dynamic";

// Профориентационный тест MentorHub: у каждого активного ученика — личная ссылка,
// она появляется у него в кабинете. Ссылки создаются в MentorHub, сюда вставляются списком.
export default async function CareerTestPage() {
  const session = await auth();
  if (!(await canEditData(session?.user?.role))) redirect("/dashboard");

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, careerTestUrl: true, groups: { select: { name: true } } },
  });
  // незаполненная маска «+7 (7__) ___-__-__» — это не телефон
  const realPhone = (p: string | null) => (p && localDigits(p) ? p : "");
  const withLink = students.filter((s) => s.careerTestUrl).length;
  const todo = students.filter((s) => !s.careerTestUrl);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Профориентация</h1>
          <p>
            Тест MentorHub · ссылки есть у {withLink} из {students.length} активных учеников · ученик видит свою ссылку в кабинете
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Вставить ссылки из MentorHub</h3>
        </div>
        <p className="mut" style={{ fontSize: 12.5, margin: 0, padding: "0 18px" }}>
          В MentorHub: «Жеке сілтемелер» → «Оқушы қосу» (имя и телефон) → скопируйте таблицу или скачайте Excel и вставьте строки сюда.
          Ученика находим по телефону, без телефона — по имени.
        </p>
        <CareerImportForm />
      </div>

      {todo.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Ещё без ссылки</h3>
            <span className="chip c-warn"><span className="d" />{todo.length}</span>
          </div>
          <div style={{ padding: "0 18px 16px" }}>
            <p className="mut" style={{ fontSize: 12.5, margin: "0 0 8px" }}>Имя и телефон — для добавления в MentorHub:</p>
            <textarea
              key={todo.map((s) => s.id).join(",")} // список изменился — перерисовать (defaultValue не обновляется)
              readOnly
              rows={Math.min(8, todo.length)}
              defaultValue={todo.map((s) => `${s.name}\t${realPhone(s.phone)}`).join("\n")}
              style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-manrope)" }}
            />
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table {...cardCols(["Ученик", "Телефон", "Ссылка на тест", ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Телефон</th>
                <th>Ссылка на тест</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">Активных учеников нет</div>
                  </td>
                </tr>
              )}
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/students/${s.id}`} style={{ fontWeight: 600, color: "inherit" }}>{s.name}</Link>
                    <div className="mut" style={{ fontSize: 11.5 }}>{s.groups.map((g) => g.name).join(", ") || "без группы"}</div>
                  </td>
                  <td className="mut num">{realPhone(s.phone) || "—"}</td>
                  <td>
                    {s.careerTestUrl ? (
                      <a href={s.careerTestUrl} target="_blank" rel="noreferrer" className="chip c-ok" style={{ textDecoration: "none" }}>
                        <span className="d" />есть ссылка
                      </a>
                    ) : (
                      <span className="chip c-mut"><span className="d" />нет</span>
                    )}
                  </td>
                  <td className="right">
                    {s.careerTestUrl && (
                      <form action={clearCareerLink.bind(null, s.id)}>
                        <button type="submit" className="link-danger" style={{ fontSize: 12.5 }}>Убрать</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
