// Импорт теста из LaTeX-исходника (как его готовят преподаватели в Overleaf/Word).
// Чистый модуль без prisma: разбор и проверка тут, запись в БД — в серверном экшене.
//
// Ожидаемый формат:
//   \item $выражение$
//   \choices{A}{B}{C}{D}
// и таблица ответов после слова «Жауаптары» / «Ответы»: «1. B & 2. A & …»

export type ParsedQuestion = {
  text: string; // читаемый текст: «3/10 + 4/10 =»
  options: string[];
  correct: number;
  tex: string; // исходник формулы — из него набирается вид у ученика
  optionsTex: string[];
};
export type ParseResult = { title: string; questions: ParsedQuestion[]; warnings: string[] };

const LETTERS = "ABCD";

// Содержимое {...}, начиная с позиции i (s[i] === "{"). Возвращает текст и позицию за скобкой.
function readBraces(s: string, i: number): [string, number] {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  throw new Error("Незакрытая скобка в исходнике");
}

// LaTeX-формула → читаемый текст: 3/10, смешанные «3 1/6», вложенные дроби в скобках.
export function latexToText(src: string, top = true): string {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\dfrac", i) || src.startsWith("\\frac", i)) {
      i += src.startsWith("\\dfrac", i) ? 6 : 5;
      while (src[i] === " ") i++;
      const [a, i1] = readBraces(src, i);
      i = i1;
      while (src[i] === " ") i++;
      const [b, i2] = readBraces(src, i);
      i = i2;
      let A = latexToText(a, false);
      let B = latexToText(b, false);
      // составной числитель или знаменатель — в скобки, иначе 1/1 + 1/2 читается неверно
      if (/[+\-·:() ]/.test(A)) A = `(${A})`;
      if (/[+\-·:() ]/.test(B)) B = `(${B})`;
      let frac = `${A}/${B}`;
      // смешанное число: 3\dfrac{1}{6} → «3 1/6»
      let k = out.length - 1;
      while (k >= 0 && /^\d$/.test(out[k])) k--;
      if (k < out.length - 1) {
        const lead = out.slice(k + 1).join("");
        out.length = k + 1;
        frac = `${lead} ${frac}`;
      }
      out.push(frac);
    } else if (src.startsWith("\\left(", i)) { out.push("("); i += 6; }
    else if (src.startsWith("\\right)", i)) { out.push(")"); i += 7; }
    else if (src.startsWith("\\left[", i)) { out.push("["); i += 6; }
    else if (src.startsWith("\\right]", i)) { out.push("]"); i += 7; }
    else if (src.startsWith("\\cdot", i)) { out.push(" · "); i += 5; }
    else if (src.startsWith("\\times", i)) { out.push(" · "); i += 6; }
    else if (src.startsWith("\\,", i) || src.startsWith("\;", i) || src.startsWith("\\!", i)) { i += 2; }
    else if (src[i] === ":") { out.push(" : "); i++; }
    else if (src[i] === "+") { out.push(" + "); i++; }
    else if (src[i] === "-") { out.push(" − "); i++; }
    else if (src[i] === "=") { i++; }
    else if (src[i] === "$") { i++; }
    else { out.push(src[i]); i++; }
  }
  const r = out.join("");
  return top ? r.replace(/\s+/g, " ").trim() : r.trim();
}

// Таблица ответов: «1. B & 2. A & …» после слова «Жауаптары» / «Ответы» / «Answers».
export function parseAnswerKey(src: string): Map<number, number> {
  const m = /(Жауаптар[ыи]?|Ответы|Answers)/i.exec(src);
  const tail = m ? src.slice(m.index) : "";
  const map = new Map<number, number>();
  for (const hit of tail.matchAll(/(\d+)\s*[.)]\s*([A-DА-Г])/gi)) {
    const letter = hit[2].toUpperCase().replace("А", "A").replace("В", "B").replace("С", "C").replace("Г", "D");
    const idx = LETTERS.indexOf(letter);
    if (idx >= 0) map.set(Number(hit[1]), idx);
  }
  return map;
}

export function parseTestSource(src: string): ParseResult {
  const warnings: string[] = [];

  // Заголовок ищем только в теле документа: до \begin{document} лежат
  // определения макросов, там \textbf{A)} из \choices — это не название теста.
  const bodyAt = src.indexOf("\\begin{document}");
  const body = bodyAt >= 0 ? src.slice(bodyAt) : src;
  const titleMatch =
    /\\(?:Large|large|huge|Huge)\s*\\textbf\{([^{}]+)\}/.exec(body) ?? /\\textbf\{([^{}]+)\}/.exec(body);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const key = parseAnswerKey(src);
  const questions: ParsedQuestion[] = [];

  // \item $...$ … \choices{}{}{}{}
  const itemRe = /\\item\s+\$([\s\S]*?)\$[\s\S]*?\\choices/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(src)) !== null) {
    const n = questions.length + 1;
    let i = m.index + m[0].length;
    const options: string[] = [];
    const optionsTex: string[] = [];
    try {
      for (let c = 0; c < 4; c++) {
        while (src[i] === " " || src[i] === "\n") i++;
        const [raw, next] = readBraces(src, i);
        i = next;
        optionsTex.push(raw.trim());
        options.push(latexToText(raw));
      }
    } catch {
      warnings.push(`Вопрос ${n}: не удалось прочитать варианты ответа — пропущен`);
      continue;
    }
    const text = latexToText(m[1]);
    if (!text) {
      warnings.push(`Вопрос ${n}: пустое условие — пропущен`);
      continue;
    }
    const correct = key.get(n);
    if (correct === undefined) {
      warnings.push(`Вопрос ${n}: в таблице ответов его нет — отмечен вариант A, проверьте вручную`);
    }
    questions.push({ text: `${text} =`, options, correct: correct ?? 0, tex: m[1].trim(), optionsTex });
    itemRe.lastIndex = i;
  }

  if (questions.length === 0) warnings.push("В тексте не найдено ни одного вопроса вида \\item … \\choices{}{}{}{}");
  else if (key.size === 0) warnings.push("Таблица ответов не найдена — везде отмечен вариант A");
  else if (key.size > questions.length) {
    warnings.push(`В таблице ответов ${key.size} записей, а вопросов ${questions.length}`);
  }

  return { title, questions, warnings };
}
