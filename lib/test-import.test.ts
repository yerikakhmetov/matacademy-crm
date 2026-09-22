import { test } from "node:test";
import assert from "node:assert/strict";
import { latexToText, parseAnswerKey, parseTestSource } from "./test-import.ts";

test("простая дробь читается как 3/10", () => {
  assert.equal(latexToText("\\dfrac{3}{10}+\\dfrac{4}{10}="), "3/10 + 4/10 =");
});

test("смешанное число не склеивается с дробью", () => {
  assert.equal(latexToText("3\\dfrac{1}{6}+\\dfrac{2}{6}="), "3 1/6 + 2/6 =");
});

test("вложенная дробь берётся в скобки, иначе смысл меняется", () => {
  assert.equal(latexToText("\\dfrac{1}{1+\\dfrac{1}{2}}="), "1/(1 + 1/2) =");
  assert.equal(latexToText("\\dfrac{2}{1+\\dfrac{1}{2+\\dfrac{1}{3}}}="), "2/(1 + 1/(2 + 1/3)) =");
});

test("скобки, умножение и деление", () => {
  assert.equal(
    latexToText("\\left(\\dfrac{5}{8}+\\dfrac{1}{4}\\right)\\cdot\\dfrac{16}{7}="),
    "(5/8 + 1/4) · 16/7 ="
  );
  assert.equal(latexToText("\\dfrac{5}{12}:\\dfrac{5}{6}="), "5/12 : 5/6 =");
});

test("периодическая дробь остаётся как есть", () => {
  assert.equal(latexToText("0,4(6)="), "0,4(6) =");
});

test("таблица ответов разбирается из строк вида «1. B & 2. A»", () => {
  const key = parseAnswerKey("Жауаптары\n1. B & 2. A & 3. C\\\\\n4. D & 5. B");
  assert.equal(key.get(1), 1);
  assert.equal(key.get(2), 0);
  assert.equal(key.get(3), 2);
  assert.equal(key.get(4), 3);
  assert.equal(key.size, 5);
});

test("номера до слова «Жауаптары» в ключ не попадают", () => {
  const key = parseAnswerKey("\\item 1. B что-то\nЖауаптары\n7. C");
  assert.deepEqual([...key.keys()], [7], "иначе номера из условий попали бы в ответы");
});

const SRC = String.raw`
\begin{center}{\Large\textbf{БӨЛШЕКТЕРГЕ АМАЛДАР ҚОЛДАНУ}}\end{center}
\begin{enumerate}
\item $\dfrac{3}{10}+\dfrac{4}{10}=$
\choices{\dfrac{1}{10}}{\dfrac{7}{10}}{\dfrac{3}{5}}{\dfrac{4}{5}}

\item $3\dfrac{1}{6}+\dfrac{2}{6}=$
\choices{3\dfrac{2}{3}}{3\dfrac{1}{2}}{4\dfrac{1}{6}}{2\dfrac{1}{2}}
\end{enumerate}
\section*{Жауаптары}
1. B & 2. B
`;

test("разбор целого файла: заголовок, вопросы, ответы", () => {
  const r = parseTestSource(SRC);
  assert.equal(r.title, "БӨЛШЕКТЕРГЕ АМАЛДАР ҚОЛДАНУ");
  assert.equal(r.questions.length, 2);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.questions[0].text, "3/10 + 4/10 =");
  assert.deepEqual(r.questions[0].options, ["1/10", "7/10", "3/5", "4/5"]);
  assert.equal(r.questions[0].correct, 1);
  assert.equal(r.questions[1].text, "3 1/6 + 2/6 =");
  assert.deepEqual(r.questions[1].options, ["3 2/3", "3 1/2", "4 1/6", "2 1/2"]);
  assert.equal(r.questions[1].correct, 1);
});

test("нет таблицы ответов — предупреждение, а не молчаливые нули", () => {
  const r = parseTestSource(SRC.slice(0, SRC.indexOf("\\section")));
  assert.equal(r.questions.length, 2);
  assert.ok(r.warnings.some((w) => w.includes("Таблица ответов не найдена")), r.warnings.join("; "));
});

test("вопрос без ответа в ключе помечается предупреждением", () => {
  const r = parseTestSource(SRC.replace("1. B & 2. B", "1. B"));
  assert.ok(r.warnings.some((w) => w.includes("Вопрос 2")), r.warnings.join("; "));
  assert.equal(r.questions[1].correct, 0);
});

test("мусор на входе не роняет разбор", () => {
  const r = parseTestSource("просто текст без задач");
  assert.equal(r.questions.length, 0);
  assert.ok(r.warnings.length > 0);
});

test("заголовок берётся из тела документа, а не из определения \\choices", () => {
  const src = String.raw`
\newcommand{\choices}[4]{\textbf{A)} $#1$ & \textbf{B)} $#2$}
\begin{document}
\begin{center}{\Large\textbf{БӨЛШЕКТЕРГЕ АМАЛДАР}}\end{center}
\item $\dfrac{1}{2}=$
\choices{\dfrac{1}{2}}{1}{2}{3}
Жауаптары
1. A
\end{document}`;
  assert.equal(parseTestSource(src).title, "БӨЛШЕКТЕРГЕ АМАЛДАР");
});

test("исходник формулы сохраняется рядом с читаемым текстом", () => {
  const src = String.raw`\begin{document}
\item $\dfrac{3}{10}+\dfrac{4}{10}=$
\choices{\dfrac{1}{10}}{\dfrac{7}{10}}{\dfrac{3}{5}}{\dfrac{4}{5}}
Жауаптары
1. B`;
  const q = parseTestSource(src).questions[0];
  assert.equal(q.text, "3/10 + 4/10 =", "читаемый текст — запасной вариант");
  assert.equal(q.tex, String.raw`\dfrac{3}{10}+\dfrac{4}{10}=`, "исходник — из него набирается формула");
  assert.deepEqual(q.optionsTex, [
    String.raw`\dfrac{1}{10}`,
    String.raw`\dfrac{7}{10}`,
    String.raw`\dfrac{3}{5}`,
    String.raw`\dfrac{4}{5}`,
  ]);
});

test("короткая запись дроби \\frac14 читается как 1/4", () => {
  assert.equal(latexToText(String.raw`\frac14a`), "1/4a");
  assert.equal(latexToText(String.raw`-\frac1{12}abc`), "− 1/12abc");
});

test("\\displaystyle не попадает ни в текст, ни в формулу", () => {
  const src = String.raw`\begin{document}
\item
\begin{testbox}
$\displaystyle 2^5\cdot2^3$
\par\medskip
\opts{2^8}{2^{15}}{4^8}{2^2}
\end{testbox}
\section*{Жауаптары}
1 & A`;
  const r = parseTestSource(src);
  assert.equal(r.questions.length, 1);
  assert.ok(!r.questions[0].tex.includes("displaystyle"), r.questions[0].tex);
  assert.equal(r.questions[0].tex, String.raw`2^5\cdot2^3`);
  assert.equal(r.questions[0].correct, 0, "ключ таблицей «1 & A» читается");
});

test("\\opts работает так же, как \\choices", () => {
  const withOpts = parseTestSource(String.raw`\begin{document}
\item $x+1$
\opts{1}{2}{3}{4}
Жауаптары
1. C`);
  assert.equal(withOpts.questions.length, 1);
  assert.deepEqual(withOpts.questions[0].options, ["1", "2", "3", "4"]);
  assert.equal(withOpts.questions[0].correct, 2);
});

test("кривая формула пропускает один вопрос, а не весь импорт", () => {
  const r = parseTestSource(String.raw`\begin{document}
\item $\frac{1}{2}$
\choices{a}{b}{c}{d}
\item $\dfrac{1}{$
\choices{a}{b}{c}{d}
Жауаптары
1. A & 2. B`);
  assert.equal(r.questions.length, 1, "первый вопрос уцелел");
  assert.ok(r.warnings.some((w) => w.includes("Вопрос 2")), r.warnings.join("; "));
});

test("словесная часть условия не теряется в запасном тексте", () => {
  assert.equal(
    latexToText(String.raw`\text{Есептеңіз: } 47^2-33^2`),
    "Есептеңіз: 47^2 − 33^2"
  );
  assert.equal(
    latexToText(String.raw`\text{Егер } x+\frac{1}{x}=3\text{ болса: } x^2`),
    "Егер x + 1/x = 3 болса: x^2"
  );
});

test("многоточие не разваливается на «· s»", () => {
  assert.equal(latexToText(String.raw`41\cdot42\cdots49`), "41 · 42 … 49");
  assert.equal(latexToText(String.raw`2^1+2^2+\cdots+2^{20}`), "2^1 + 2^2 + … + 2^{20}");
  assert.equal(latexToText(String.raw`a\ldots b`), "a … b");
});

test("защищённый пробел не оставляет обратный слеш", () => {
  assert.equal(latexToText(String.raw`8^{50}.\ D`), "8^{50}. D");
});

test("ондық үтір {,} мәтінде жай үтір болып қалады", () => {
  assert.equal(latexToText(String.raw`0{,}3(1-2x)+2{,}1x`), "0,3(1 − 2x) + 2,1x");
});

test("теңдеулер жүйесі запасной мәтінде оқылады", () => {
  assert.equal(latexToText(String.raw`\begin{cases}y=2x\\x-y=3\end{cases}`), "{y = 2x; x − y = 3}");
  assert.equal(latexToText(String.raw`\varnothing`), "∅");
});

test("нүктелі үтір жұтылмайды, ал \; бос орын ретінде жоғалады", () => {
  assert.equal(latexToText(String.raw`(-3;-6)`), "( − 3; − 6)");
  assert.equal(latexToText(String.raw`a\;b`), "ab");
});

test("мәтіндік есепке «=» жалғанбайды", () => {
  const r = parseTestSource(String.raw`\begin{document}
\item $\text{(15; 25) аралығында неше натурал сан бар?}$
\choices{11}{8}{10}{9}
\item $\frac{1}{2}+\frac{1}{3}$
\choices{a}{b}{c}{d}
Жауаптары
1. D & 2. A`);
  assert.equal(r.questions[0].text, "(15; 25) аралығында неше натурал сан бар?");
  assert.equal(r.questions[1].text, "1/2 + 1/3 =", "өрнекке бұрынғыдай қосылады");
});
