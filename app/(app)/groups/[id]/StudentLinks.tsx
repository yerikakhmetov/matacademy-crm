"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

// Куратору нужны обе ссылки прямо в списке группы: кабинет — ученику,
// портал — родителю. Полный адрес известен только на клиенте.
export function StudentLinks({ joinToken, portalToken }: { joinToken: string | null; portalToken: string | null }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const copy = async (key: string, path: string) => {
    try {
      await navigator.clipboard.writeText(`${origin || ""}${path}`);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  };

  const btn = (key: string, path: string | null, label: string) =>
    path ? (
      <button
        className="btn ghost"
        type="button"
        onClick={() => copy(key, path)}
        title={`${origin}${path}`}
        style={{ padding: "3px 9px", fontSize: 11.5, whiteSpace: "nowrap" }}
      >
        <Icon name={copied === key ? "check" : "export"} size={12} />
        {copied === key ? "Скопировано" : label}
      </button>
    ) : (
      <span className="mut" style={{ fontSize: 11.5 }}>—</span>
    );

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {btn("join", joinToken ? `/join/${joinToken}` : null, "Кабинет")}
      {btn("portal", portalToken ? `/p/${portalToken}` : null, "Родителю")}
    </div>
  );
}
