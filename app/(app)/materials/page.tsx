import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { MaterialUpload } from "./MaterialUpload";
import { DeleteMaterialButton } from "./DeleteMaterialButton";

export const dynamic = "force-dynamic";

function fileExt(name: string) {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

export default async function MaterialsPage() {
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const editor = canEdit(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  // группы для загрузки/фильтра
  const groups = await prisma.group.findMany({
    where: teacher ? { teacherId: myTeacherId ?? "__none__" } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const groupIds = groups.map((g) => g.id);

  const materials = await prisma.material.findMany({
    where: teacher ? { OR: [{ groupId: null }, { groupId: { in: groupIds } }] } : {},
    include: { group: { select: { name: true, color: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const canUpload = editor || teacher;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Материалы</h1>
          <p>{materials.length} файлов · доступны ученикам и родителям</p>
        </div>
        {canUpload && <MaterialUpload groups={groups} groupId="all" />}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                <th>Группа</th>
                <th>Загрузил</th>
                <th>Дата</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Материалов пока нет{canUpload ? " — загрузите первый файл" : ""}</div>
                  </td>
                </tr>
              )}
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="person" style={{ textDecoration: "none" }}>
                      <div className="pay-ico" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10, fontWeight: 800 }}>
                        {fileExt(m.fileName).slice(0, 4)}
                      </div>
                      <div>
                        <div className="nm">{m.title}</div>
                        <div className="sub">{m.fileName}</div>
                      </div>
                    </a>
                  </td>
                  <td>
                    {m.group ? (
                      <span className="chip c-mut"><span className="d" style={{ background: m.group.color }} />{m.group.name}</span>
                    ) : (
                      <span className="mut">Для всех</span>
                    )}
                  </td>
                  <td className="mut">{m.uploadedBy ?? "—"}</td>
                  <td className="mut">{formatDate(m.createdAt)}</td>
                  <td className="right">
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                      <a className="btn ghost" href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 11px", fontSize: 12.5 }}>
                        <Icon name="export" size={14} />
                        Открыть
                      </a>
                      {canUpload && <DeleteMaterialButton id={m.id} />}
                    </div>
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
