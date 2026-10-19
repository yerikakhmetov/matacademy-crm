import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { curatorGroupIds, groupWhereFor, isCurator } from "@/lib/curator";
import { initials, avatarColor, scoreColor, GRADE_TYPE } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { lastSchoolMonths, schoolClock } from "@/lib/school-time";
import { cardCols } from "@/lib/card-table";
import { ModalButton } from "@/components/ModalButton";
import { BulkGradeForm, GradeForm } from "./GradeForm";
import { GroupSelect } from "./GroupSelect";
import { GradeChips } from "./GradeChips";
import { addGrade, addGradesBulk } from "@/app/actions/grades";

export const dynamic = "force-dynamic";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const TYPE_PLURAL: Record<string, string> = {
  HOMEWORK: "Домашние",
  TEST: "Контрольные",
  QUIZ: "Самостоятельные",
  EXAM: "Экзамены",
};

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; month?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const canManage = await canEditData(session?.user?.role) || teacher;
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;
  const curator = isCurator(session?.user?.role);
  // куратор видит только закреплённые за ним группы
  const curGroupIds = curator ? await curatorGroupIds(session?.user?.id) : [];

  const groups = await prisma.group.findMany({
    where: groupWhereFor({ teacher, teacherId: myTeacherId, curator, groupIds: curGroupIds }),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (groups.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Успеваемость</h1>
            <p>Оценки учеников по группам</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">{teacher ? "За вами пока не закреплены группы" : "Сначала создайте группу"}</div>
        </div>
      </>
    );
  }

  const groupId = sp.group && groups.some((g) => g.id === sp.group) ? sp.group : groups[0].id;

  // Месяц: «2026-9» (month0) или «all»; по умолчанию — текущий месяц школы.
  const tz = (await getSettings()).tzOffsetHours;
  const monthList = lastSchoolMonths(12, tz).reverse();
  const nowKey = (() => {
    const c = schoolClock(tz);
    return `${c.getUTCFullYear()}-${c.getUTCMonth()}`;
  })();
  const month = sp.month === "all" || monthList.some((m) => m.key === sp.month) ? sp.month! : nowKey;
  const picked = monthList.find((m) => m.key === month);
  const type = sp.type && sp.type in GRADE_TYPE ? sp.type : "all";
  // даты оценок хранятся UTC-полночью, поэтому границы месяца — тоже UTC
  const dateWhere = picked
    ? { gte: new Date(Date.UTC(picked.year, picked.month0, 1)), lt: new Date(Date.UTC(picked.year, picked.month0 + 1, 1)) }
    : undefined;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      teacher: true,
      students: {
        orderBy: { name: "asc" },
        // только оценки этой группы: ученик может заниматься в нескольких,
        // и раньше его чужие оценки показывались здесь же
        include: { grades: { where: { groupId, date: dateWhere, ...(type !== "all" ? { type } : {}) }, orderBy: { date: "desc" } } },
      },
    },
  });
  if (!group) return null;

  // Средняя по группе
  const allGrades = group.students.flatMap((s) => s.grades);
  const groupAvg =
    allGrades.length > 0 ? Math.round(allGrades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / allGrades.length) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Успеваемость</h1>
          <p>
            {group.name} · {group.teacher?.name ?? "без преподавателя"} · {picked ? `${MONTHS[picked.month0]} ${picked.year}` : "всё время"}
            {type !== "all" ? ` · ${TYPE_PLURAL[type].toLowerCase()}` : ""}
          </p>
        </div>
        {groupAvg != null && (
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
              {type === "HOMEWORK" ? "Средний балл за ДЗ" : "Средний балл группы"}
            </div>
            <div className="kval num" style={{ fontSize: 26, color: scoreColor(groupAvg) }}>
              {groupAvg}%
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        {canManage && group.students.length > 0 && (
          <ModalButton
            label="Оценки группе"
            title={`Оценки группе · ${group.name}`}
            icon="plus"
            action={addGradesBulk.bind(null, group.id)}
            submitLabel="Поставить"
          >
            <BulkGradeForm students={group.students.map((s) => ({ id: s.id, name: s.name }))} />
          </ModalButton>
        )}
        <GroupSelect
          groups={groups}
          groupId={groupId}
          months={[
            ...monthList.map((m) => ({ key: m.key, label: `${MONTHS[m.month0]} ${m.year}` })),
            { key: "all", label: "Все месяцы" },
          ]}
          month={month}
          types={[{ key: "all", label: "Все виды оценок" }, ...Object.entries(TYPE_PLURAL).map(([key, label]) => ({ key, label }))]}
          type={type}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          {/* на телефоне — карточка ученика: имя, оценки во всю ширину, средний, кнопка */}
          <table {...cardCols(["Ученик", "", "Средний", canManage && ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Оценки</th>
                <th className="right">Средний</th>
                {canManage && <th className="right"></th>}
              </tr>
            </thead>
            <tbody>
              {group.students.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3}>
                    <div className="empty">В группе нет учеников</div>
                  </td>
                </tr>
              )}
              {group.students.map((s) => {
                const avg =
                  s.grades.length > 0
                    ? Math.round(s.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / s.grades.length)
                    : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(s.name), width: 30, height: 30, fontSize: 11 }}>
                          {initials(s.name)}
                        </div>
                        <div className="nm" style={{ fontSize: 13.5 }}>
                          {s.name}
                        </div>
                      </div>
                    </td>
                    <td className="td-wide">
                      <GradeChips grades={s.grades} canManage={canManage} />
                    </td>
                    <td className="right num" style={{ fontWeight: 700, color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
                      <span>
                        {avg != null ? `${avg}%` : "—"}
                        {s.grades.length > 0 && (
                          <span className="mut" style={{ fontSize: 11, fontWeight: 500, marginLeft: 6 }}>
                            {s.grades.length} оц.
                          </span>
                        )}
                      </span>
                    </td>
                    {canManage && (
                      <td className="right">
                        <ModalButton
                          label="Оценка"
                          title={`Оценка · ${s.name}`}
                          icon="plus"
                          buttonClass="btn ghost"
                          action={addGrade.bind(null, s.id)}
                          submitLabel="Поставить"
                        >
                          <GradeForm groupId={group.id} />
                        </ModalButton>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
