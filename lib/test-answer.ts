// Вопрос теста бывает с одним верным вариантом или с несколькими (ҰБТ: «жауап(тар)ды табыңыз»).
// Чистые функции без БД: ими пользуются подсчёт балла, кабинет ученика и страница теста.
//
// Как хранится ответ ученика (TestAttempt.answers, по числу на вопрос):
//   • один верный вариант — индекс выбранного варианта, -1 = без ответа;
//   • несколько верных — битовая маска выбранных вариантов (вариант i → бит 1 << i),
//     0 или -1 = без ответа. Так массив остаётся Int[] и старые попытки не трогаем.

export type AnswerKey = {
  correct: number; // индекс верного варианта; у вопроса с несколькими — первый из них
  correctSet?: number[] | null; // все верные варианты, если их больше одного
};

/** Индексы верных вариантов по возрастанию. */
export function correctIndices(q: AnswerKey): number[] {
  const set = q.correctSet ?? [];
  if (set.length > 1) return [...new Set(set)].sort((a, b) => a - b);
  return [q.correct];
}

/** Вопрос с несколькими верными вариантами — ученик отмечает галочками. */
export function isMulti(q: AnswerKey): boolean {
  return correctIndices(q).length > 1;
}

export function maskOf(indices: number[]): number {
  return indices.reduce((m, i) => m | (1 << i), 0);
}

export function indicesOf(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 31; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

/** Какие варианты выбрал ученик. */
export function chosenIndices(q: AnswerKey, choice: number | null | undefined): number[] {
  if (choice == null || choice < 0) return [];
  return isMulti(q) ? indicesOf(choice) : [choice];
}

export function isAnswered(q: AnswerKey, choice: number | null | undefined): boolean {
  return chosenIndices(q, choice).length > 0;
}

/** Ответ засчитан: один вариант — совпал; несколько — отмечены ровно все верные и ни одного лишнего. */
export function isRight(q: AnswerKey, choice: number | null | undefined): boolean {
  if (choice == null || choice < 0) return false;
  if (!isMulti(q)) return choice === q.correct;
  return choice > 0 && choice === maskOf(correctIndices(q));
}

/** Переключить вариант в ответе на вопрос с несколькими верными; пустой выбор → -1. */
export function toggleOption(choice: number, option: number): number {
  const mask = (choice > 0 ? choice : 0) ^ (1 << option);
  return mask === 0 ? -1 : mask;
}

/** Балл за попытку: доля засчитанных вопросов от maxScore. */
export function scoreAnswers(questions: AnswerKey[], answers: number[], maxScore: number) {
  const total = questions.length;
  const correctCount = questions.reduce((a, q, i) => a + (isRight(q, answers[i]) ? 1 : 0), 0);
  return { total, correctCount, score: total > 0 ? Math.round((correctCount / total) * maxScore) : 0 };
}

/**
 * Ответ из сохранённой попытки, когда вопрос сменил тип (обновили вопросы теста):
 * один вариант → несколько — индекс превращается в маску из одного бита;
 * несколько → один — остаётся, только если был отмечен ровно один вариант.
 */
export function convertAnswer(oldQ: AnswerKey, newQ: AnswerKey, choice: number): number {
  if (choice == null || choice < 0) return -1;
  const wasMulti = isMulti(oldQ);
  const nowMulti = isMulti(newQ);
  if (wasMulti === nowMulti) return choice;
  if (nowMulti) return maskOf([choice]);
  const picked = indicesOf(choice);
  return picked.length === 1 ? picked[0] : -1;
}
