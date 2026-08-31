import { ROLE_LABEL } from "@/lib/roles";

type Values = { name?: string; email?: string; role?: string };

export function UserForm({ values, isEdit }: { values?: Values; isEdit?: boolean }) {
  return (
    <>
      <div className="field">
        <label>Имя *</label>
        <input name="name" required defaultValue={values?.name ?? ""} placeholder="Айгерим Ж." />
      </div>
      {!isEdit && (
        <div className="field">
          <label>Email *</label>
          <input name="email" type="email" required placeholder="user@matacademy.kz" autoComplete="off" />
        </div>
      )}
      <div className="field">
        <label>Роль</label>
        <select name="role" defaultValue={values?.role ?? "MANAGER"}>
          {(["ADMIN", "MANAGER", "TEACHER"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{isEdit ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль *"}</label>
        <input name="password" type="password" required={!isEdit} minLength={6} placeholder="минимум 6 символов" autoComplete="new-password" />
      </div>
    </>
  );
}
