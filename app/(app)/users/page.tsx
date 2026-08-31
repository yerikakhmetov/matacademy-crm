import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { initials, avatarColor, formatDate } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { UserForm } from "./UserForm";
import { DeleteUserButton } from "./DeleteUserButton";
import { createUser, updateUser } from "@/app/actions/data";

export const dynamic = "force-dynamic";

const ROLE_CLASS: Record<string, string> = { ADMIN: "c-bad", MANAGER: "c-acc", TEACHER: "c-vio" };

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");
  const meId = session.user.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, telegramUserId: true, createdAt: true },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Пользователи</h1>
          <p>{users.length} учётных записей · доступ к системе</p>
        </div>
        <ModalButton label="Новый пользователь" title="Новый пользователь" action={createUser}>
          <UserForm />
        </ModalButton>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Вход</th>
                <th>Создан</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(u.name), width: 32, height: 32, fontSize: 12 }}>
                          {initials(u.name)}
                        </div>
                        <div className="nm" style={{ fontSize: 13.5 }}>
                          {u.name}
                          {isSelf && <span className="mut" style={{ fontSize: 11, fontWeight: 400 }}> · вы</span>}
                        </div>
                      </div>
                    </td>
                    <td className="mut">{u.email}</td>
                    <td>
                      <span className={`chip ${ROLE_CLASS[u.role] ?? "c-mut"}`}>
                        <span className="d" />
                        {ROLE_LABEL[u.role as Role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      {u.telegramUserId ? (
                        <span className="chip c-teal" style={{ fontSize: 11 }}><span className="d" />Telegram</span>
                      ) : (
                        <span className="mut" style={{ fontSize: 12 }}>email/пароль</span>
                      )}
                    </td>
                    <td className="mut">{formatDate(u.createdAt)}</td>
                    <td className="right">
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <ModalButton label="Изменить" title={`Пользователь · ${u.name}`} icon="edit" buttonClass="btn ghost" action={updateUser.bind(null, u.id)}>
                          <UserForm values={u} isEdit />
                        </ModalButton>
                        {!isSelf && <DeleteUserButton id={u.id} name={u.name} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        Администратор — полный доступ · Менеджер — всё, кроме управления пользователями и настроек · Преподаватель — только свои группы (вход через Telegram).
      </p>
    </>
  );
}
