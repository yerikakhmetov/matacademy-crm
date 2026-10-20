"use client";

import { useState, useTransition } from "react";
import { importCareerLinks, type CareerImportResult } from "@/app/actions/career";

// Вставка списка из MentorHub: «Имя | Телефон | Ссылка» построчно или таблица из Excel.
export function CareerImportForm() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<CareerImportResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ padding: 18 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"Айдос Серікұлы | 87051112233 | https://www.mentorhub.one/…\nили скопированная таблица из Excel MentorHub"}
        style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-manrope)" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          disabled={pending || !text.trim()}
          onClick={() =>
            start(async () => {
              const r = await importCareerLinks(text);
              setRes(r);
              if (!r.error && !r.unmatched?.length) setText("");
            })
          }
        >
          {pending ? "…" : "Сохранить ссылки"}
        </button>
        {res?.error && <span role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>{res.error}</span>}
        {res && !res.error && <span className="mut" style={{ fontSize: 13 }}>Сохранено: {res.saved}</span>}
      </div>
      {res?.unmatched && res.unmatched.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          <div style={{ color: "var(--bad)", fontWeight: 600 }}>Не нашли ученика ({res.unmatched.length}) — проверьте телефон или имя:</div>
          {res.unmatched.map((l, i) => (
            <div key={i} className="mut" style={{ wordBreak: "break-all" }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
