import katex from "katex";

// Формулы набираем на сервере: в браузер уходит готовый HTML и один CSS,
// без библиотеки в клиентском бандле — кабинет чаще открывают с телефона.
//
// tex — исходник вопроса, plain — читаемый текст («3/10»). Если формула битая,
// KaTeX не бросает исключение, а мы просто отдаём plain: вопрос должен открыться
// в любом случае, даже если преподаватель ошибся в разметке.
export function renderMath(tex: string | null | undefined, plain: string): string {
  if (!tex || !tex.trim()) return escapeHtml(plain);
  try {
    return katex.renderToString(tex, {
      throwOnError: true,
      displayMode: false,
      output: "html",
      strict: false,
      trust: false, // \href и подобное запрещено
    });
  } catch {
    return escapeHtml(plain);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Вопрос в том виде, в каком его показываем ученику.
export type RenderedQuestion = { textHtml: string; optionsHtml: string[] };

export function renderQuestion(q: {
  text: string;
  options: string[];
  textTex?: string | null;
  optionsTex?: string[];
}): RenderedQuestion {
  const tex = q.optionsTex ?? [];
  return {
    textHtml: renderMath(q.textTex, q.text),
    optionsHtml: q.options.map((o, i) => renderMath(tex[i], o)),
  };
}
