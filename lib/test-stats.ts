// Разбор результатов теста: где группа спотыкается.
// Чистые функции без БД — их проще проверить тестами.

export type StatQuestion = { correct: number; optionsCount: number };
export type StatAttempt = { answers: number[] };

export type QuestionStat = {
  index: number;
  answered: number; // сколько человек вообще ответили
  correct: number; // сколько ответили верно
  correctPct: number; // 0..100 от числа проходивших
  /** сколько человек выбрало каждый вариант (по индексу варианта) */
  byOption: number[];
  /** никто не ответил — вопрос пропускали */
  skipped: number;
};

// Статистика по каждому вопросу: доля верных и распределение по вариантам.
export function questionStats(questions: StatQuestion[], attempts: StatAttempt[]): QuestionStat[] {
  const total = attempts.length;
  return questions.map((q, i) => {
    const byOption = new Array(Math.max(0, q.optionsCount)).fill(0);
    let correct = 0;
    let answered = 0;
    for (const a of attempts) {
      const choice = a.answers[i];
      if (choice == null || choice < 0) continue;
      answered++;
      if (choice < byOption.length) byOption[choice]++;
      if (choice === q.correct) correct++;
    }
    return {
      index: i,
      answered,
      correct,
      correctPct: total > 0 ? Math.round((correct / total) * 100) : 0,
      byOption,
      skipped: total - answered,
    };
  });
}

// Вопросы, которые стоит разобрать на уроке: где верных ответов меньше порога.
export function hardestQuestions(stats: QuestionStat[], thresholdPct = 60): QuestionStat[] {
  return stats.filter((s) => s.correctPct < thresholdPct).sort((a, b) => a.correctPct - b.correctPct);
}
