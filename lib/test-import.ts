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

// \\displaystyle влияет только на вёрстку в LaTeX, в тексте и в наборе он лишний
function stripDisplay(s: string): string {
  return s.replace(/\\displaystyle\s*/g, "").replace(/\s+/g, " ").trim();
}

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

// Аргумент дроби: обычно {…}, но в LaTeX допустима и короткая запись
// \\frac14 — тогда аргумент это один символ.
function readFracArg(s: string, i: number): [string, number] {
  if (s[i] === "{") return readBraces(s, i);
  if (i < s.length) return [s[i], i + 1];
  throw new Error("Дробь без аргумента");
}

// LaTeX-формула → читаемый текст: 3/10, смешанные «3 1/6», вложенные дроби в скобках.
export function latexToText(src: string, top = true): string {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\dfrac", i) || src.startsWith("\\frac", i)) {
      i += src.startsWith("\\dfrac", i) ? 6 : 5;
      while (src[i] === " ") i++;
      const [a, i1] = readFracArg(src, i);
      i = i1;
      while (src[i] === " ") i++;
      const [b, i2] = readFracArg(src, i);
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
    } else if (src.startsWith("\\text", i) || src.startsWith("\\mathrm", i)) {
      // \text{Есептеңіз: } — словесная часть условия. В наборе её показывает
      // KaTeX, а в запасном тексте оставляем просто слова, без разметки.
      i += src.startsWith("\\text", i) ? 5 : 7;
      while (src[i] === " ") i++;
      if (src[i] === "{") {
        const [inner, next] = readBraces(src, i);
        i = next;
        out.push(inner);
      }
    } else if (src.startsWith("\\left(", i)) { out.push("("); i += 6; }
    else if (src.startsWith("\\right)", i)) { out.push(")"); i += 7; }
    else if (src.startsWith("\\left[", i)) { out.push("["); i += 6; }
    else if (src.startsWith("\\right]", i)) { out.push("]"); i += 7; }
    else if (src.startsWith("\\cdots", i) || src.startsWith("\\ldots", i) || src.startsWith("\\dots", i)) {
      out.push(" … ");
      i += src.startsWith("\\dots", i) && !src.startsWith("\\dotsb", i) ? 5 : 6;
    }
    else if (src.startsWith("\\cdot", i)) { out.push(" · "); i += 5; }
    else if (src.startsWith("\\times", i)) { out.push(" · "); i += 6; }
    else if (src.startsWith("\\,", i) || src.startsWith("\;", i) || src.startsWith("\\!", i)) { i += 2; }
    else if (src.startsWith("\\ ", i)) { out.push(" "); i += 2; }
    else if (src[i] === ":") { out.push(" : "); i++; }
    else if (src[i] === "+") { out.push(" + "); i++; }
    else if (src[i] === "-") { out.push(" − "); i++; }
    else if (src[i] === "=") { out.push(" = "); i++; }
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
  // «1. B», «1) B» и табличное «1 & A» — в LaTeX ключ часто рисуют таблицей
  for (const hit of tail.matchAll(/(\d+)\s*[.)&]\s*([A-DА-Г])\b/gi)) {
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
  // Условие в $…$, затем варианты: \\choices{}{}{}{} или \\opts{}{}{}{} —
  // преподаватели пользуются обеими заготовками.
  const itemRe = /\\item\b[\s\S]*?\$([\s\S]*?)\$[\s\S]*?\\(?:choices|opts)\s*/g;
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
        optionsTex.push(stripDisplay(raw).trim());
        options.push(latexToText(stripDisplay(raw)));
      }
    } catch {
      warnings.push(`Вопрос ${n}: не удалось прочитать варианты ответа — пропущен`);
      continue;
    }
    let text: string;
    try {
      text = latexToText(stripDisplay(m[1]));
    } catch {
      warnings.push(`Вопрос ${n}: условие не разобралось — пропущен`);
      continue;
    }
    if (!text) {
      warnings.push(`Вопрос ${n}: пустое условие — пропущен`);
      continue;
    }
    const correct = key.get(n);
    if (correct === undefined) {
      warnings.push(`Вопрос ${n}: в таблице ответов его нет — отмечен вариант A, проверьте вручную`);
    }
    // «=» уже мог быть в условии (уравнение, «Егер …»); дописываем только если его нет
    const shown = text.includes("=") ? text : `${text} =`;
    questions.push({ text: shown, options, correct: correct ?? 0, tex: stripDisplay(m[1]).trim(), optionsTex });
    itemRe.lastIndex = i;
  }

  if (questions.length === 0) warnings.push("В тексте не найдено ни одного вопроса вида \\item … \\choices{}{}{}{}");
  else if (key.size === 0) warnings.push("Таблица ответов не найдена — везде отмечен вариант A");
  else if (key.size > questions.length) {
    warnings.push(`В таблице ответов ${key.size} записей, а вопросов ${questions.length}`);
  }

  return { title, questions, warnings };
}
