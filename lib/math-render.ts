import katex from "katex";

// Формулы набираем на сервере: в браузер уходит готовый HTML и один CSS,
// без библиотеки в клиентском бандле — кабинет чаще открывают с телефона.
//
// tex — исходник вопроса, plain — читаемый текст («3/10»). Если формула битая,
// KaTeX не бросает исключение, а мы просто отдаём plain: вопрос должен открыться
// в любом случае, даже если преподаватель ошибся в разметке.
const KATEX_OPTS = {
  throwOnError: true,
  displayMode: false,
  output: "html" as const,
  strict: false,
  trust: false, // \href и подобное запрещено
};

// Словесную часть условия (\text{…}) отдаём обычным текстом, а не KaTeX:
// внутри формулы строка не переносится, и длинная текстовая задача уезжала
// за край экрана телефона. Разбиваем на куски: текст — как текст, математика —
// через KaTeX; между ними обычные пробелы, поэтому абзац переносится сам.
function splitText(tex: string): { text: boolean; body: string }[] {
  const parts: { text: boolean; body: string }[] = [];
  let i = 0;
  let mathFrom = 0;
  while (i < tex.length) {
    if (tex.startsWith("\\text", i) && !/[a-zA-Z]/.test(tex[i + 5] ?? "")) {
      let j = i + 5;
      while (tex[j] === " ") j++;
      if (tex[j] === "{") {
        let depth = 0;
        let k = j;
        for (; k < tex.length; k++) {
          if (tex[k] === "{") depth++;
          else if (tex[k] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth === 0) {
          if (i > mathFrom) parts.push({ text: false, body: tex.slice(mathFrom, i) });
          parts.push({ text: true, body: tex.slice(j + 1, k) });
          i = mathFrom = k + 1;
          continue;
        }
      }
    }
    i++;
  }
  if (mathFrom < tex.length) parts.push({ text: false, body: tex.slice(mathFrom) });
  return parts;
}

export function renderMath(tex: string | null | undefined, plain: string): string {
  if (!tex || !tex.trim()) return escapeHtml(plain);
  try {
    const parts = splitText(tex);
    if (parts.length <= 1 && !parts.some((p) => p.text)) return katex.renderToString(tex, KATEX_OPTS);
    return parts
      .map((p) => (p.text ? escapeHtml(p.body) : p.body.trim() ? katex.renderToString(p.body, KATEX_OPTS) : ""))
      .join("");
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
