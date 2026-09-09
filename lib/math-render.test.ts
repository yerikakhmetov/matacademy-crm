import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderMath, renderQuestion } from "./math-render.ts";

test("формула превращается в разметку KaTeX", () => {
  const html = renderMath("\\dfrac{3}{10}", "3/10");
  assert.ok(html.includes("katex"), html.slice(0, 80));
  assert.ok(html.includes("3") && html.includes("10"));
});

test("битая формула не роняет вопрос — показываем читаемый текст", () => {
  assert.equal(renderMath("\\dfrac{3}{", "3/10"), "3/10");
});

test("без исходника показываем обычный текст", () => {
  assert.equal(renderMath(null, "3/10"), "3/10");
  assert.equal(renderMath("   ", "3/10"), "3/10");
});

test("текст без формулы экранируется — вопрос не может внедрить разметку", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(renderMath(null, "<b>2</b> < 3"), "&lt;b&gt;2&lt;/b&gt; &lt; 3");
});

test("вопрос целиком: условие и все варианты", () => {
  const r = renderQuestion({
    text: "3/10 + 4/10 =",
    options: ["1/10", "7/10", "3/5", "4/5"],
    textTex: "\\dfrac{3}{10}+\\dfrac{4}{10}=",
    optionsTex: ["\\dfrac{1}{10}", "\\dfrac{7}{10}", "\\dfrac{3}{5}", "\\dfrac{4}{5}"],
  });
  assert.ok(r.textHtml.includes("katex"));
  assert.equal(r.optionsHtml.length, 4);
  for (const o of r.optionsHtml) assert.ok(o.includes("katex"), o.slice(0, 60));
});

test("вопрос без LaTeX остаётся текстовым", () => {
  const r = renderQuestion({ text: "Сколько будет 2+2?", options: ["3", "4"] });
  assert.equal(r.textHtml, "Сколько будет 2+2?");
  assert.deepEqual(r.optionsHtml, ["3", "4"]);
});
