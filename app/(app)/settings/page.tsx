import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings, parseTariffs, tariffsToText, DEFAULT_TEMPLATES, DISCOUNT_MODE_LABEL } from "@/lib/settings";
import { MANAGER_PERMS, parseDenied } from "@/lib/access";
import { updateSettings } from "@/app/actions/data";
import { SaveButton } from "./SaveButton";
import { ClearDataButton } from "./ClearDataButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const s = await getSettings();
  const tariffsText = tariffsToText(parseTariffs(s.tariffs));
  const denied = parseDenied(s.managerDenied);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Настройки школы</h1>
          <p>Название, филиалы, кабинеты и тарифы — используются в формах и квитанциях</p>
        </div>
      </div>

      <form action={updateSettings} style={{ maxWidth: 720 }}>
        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 16 }}>
            Основное
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Название школы</label>
            <input name="schoolName" defaultValue={s.schoolName} />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Адрес (для квитанций)</label>
            <input name="address" defaultValue={s.address} placeholder="г. Алматы, ул. Абая, 52" />
          </div>
          <div className="grid2">
            <div className="field">
              <label>Филиалы (через запятую)</label>
              <input name="branches" defaultValue={s.branches} placeholder="Абая, Сатпаева" />
            </div>
            <div className="field">
              <label>Кабинеты (через запятую)</label>
              <input name="rooms" defaultValue={s.rooms} placeholder="Каб. 1, Каб. 2, Каб. 3" />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>
            Тарифы абонементов
          </div>
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            По одному тарифу в строке в формате: <b>Название | месяцев | цена</b>. Например: <code>6 месяцев | 6 | 90000</code>
          </p>
          <div className="field">
            <textarea name="tariffs" defaultValue={tariffsText} rows={6} style={{ fontFamily: "var(--font-manrope)", resize: "vertical" }} />
          </div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>
            Скидки
          </div>
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            Спец-скидки (для отдельных групп людей) — по одной в строке: <b>Название | процент</b>. Например: <code>Брат/сестра | 10</code>
          </p>
          <div className="field" style={{ marginBottom: 16 }}>
            <textarea name="discounts" defaultValue={s.discounts} rows={4} placeholder={"Брат/сестра | 10\nМногодетная семья | 15\nРекомендация | 5"} style={{ fontFamily: "var(--font-manrope)", resize: "vertical" }} />
          </div>
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            Скидка за несколько предметов — <b>кол-во предметов | процент</b> (от указанного количества). Например: <code>2 | 10</code>, <code>3 | 15</code>
          </p>
          <div className="field" style={{ marginBottom: 16 }}>
            <textarea name="multiDiscount" defaultValue={s.multiDiscount} rows={3} placeholder={"2 | 10\n3 | 15"} style={{ fontFamily: "var(--font-manrope)", resize: "vertical" }} />
          </div>
          <div className="grid2">
            <div className="field">
              <label>Как объединять скидки</label>
              <select name="discountMode" defaultValue={s.discountMode}>
                {(Object.keys(DISCOUNT_MODE_LABEL) as (keyof typeof DISCOUNT_MODE_LABEL)[]).map((m) => (
                  <option key={m} value={m}>{DISCOUNT_MODE_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Скидка «брат/сестра», %</label>
              <input name="siblingDiscount" type="number" min={0} max={100} defaultValue={s.siblingDiscount} />
            </div>
          </div>
          <p className="mut" style={{ fontSize: 12, margin: "8px 0 0" }}>
            «Брат/сестра» применяется автоматически, если у ученика есть другой активный ученик с тем же телефоном родителя. 0 — выключено.
          </p>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>
            Шаблоны напоминаний (Telegram)
          </div>
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 14px" }}>
            Плейсхолдеры подставятся автоматически: <code>{"{school}"}</code> <code>{"{name}"}</code> <code>{"{purpose}"}</code> <code>{"{amount}"}</code> <code>{"{days}"}</code> <code>{"{plan}"}</code> <code>{"{date}"}</code>. Пусто — используется стандартный текст.
          </p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Долг (просрочка)</label>
            <textarea name="tplOverdue" rows={2} defaultValue={s.tplOverdue} placeholder={DEFAULT_TEMPLATES.overdue} style={{ resize: "vertical", fontFamily: "var(--font-manrope)" }} />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Ожидает оплаты</label>
            <textarea name="tplPending" rows={2} defaultValue={s.tplPending} placeholder={DEFAULT_TEMPLATES.pending} style={{ resize: "vertical", fontFamily: "var(--font-manrope)" }} />
          </div>
          <div className="field">
            <label>Абонемент истекает</label>
            <textarea name="tplExpiring" rows={2} defaultValue={s.tplExpiring} placeholder={DEFAULT_TEMPLATES.expiring} style={{ resize: "vertical", fontFamily: "var(--font-manrope)" }} />
          </div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>
            Права менеджера
          </div>
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 14px" }}>
            Отметьте, какие разделы и действия доступны роли «Менеджер». Администратор всегда имеет полный доступ, преподаватель — только свой кабинет.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MANAGER_PERMS.map((p) => (
              <label key={p.key} className="perm-row" style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" name={`perm_${p.key}`} defaultChecked={!denied.has(p.key)} style={{ marginTop: 3, width: 18, height: 18, flex: "none" }} />
                <span>
                  <span style={{ fontWeight: 600 }}>{p.label}</span>
                  <span className="mut" style={{ display: "block", fontSize: 12.5 }}>{p.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <SaveButton />
      </form>

      <div className="card" style={{ padding: 22, marginTop: 24, maxWidth: 720, borderColor: "var(--bad)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--bad)", fontWeight: 700, marginBottom: 6 }}>
          Опасная зона
        </div>
        <p className="mut" style={{ fontSize: 13, margin: "0 0 14px" }}>
          Удалить все демо-данные, чтобы начать работу школы с чистого листа. Логины и настройки останутся.
        </p>
        <ClearDataButton />
      </div>
    </>
  );
}
