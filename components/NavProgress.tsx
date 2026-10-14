"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Полоса загрузки сверху при переходе между страницами. Серверные страницы CRM
// грузятся по 0,5–2 с, и без неё на телефоне кажется, что нажатие не сработало.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  // адрес сменился — новая страница пришла
  useEffect(() => setLoading(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // якорь или та же страница
      if (url.pathname.startsWith("/api/")) return; // выгрузки CSV — не переход
      setLoading(true);
    };
    // capture: Link сам вызывает preventDefault на всплытии, до нас бы клик дошёл уже «отменённым»
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // страховка: если переход не случился (ошибка сети), полоса не висит вечно
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(t);
  }, [loading]);

  return <div className={`nav-progress${loading ? " on" : ""}`} aria-hidden="true" />;
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
