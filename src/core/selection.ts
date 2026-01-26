import type { QuizQuestion } from './types';

export const shuffle = <T>(items: T[]) => {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const buildRandomQueue = (questions: QuizQuestion[]) => shuffle(questions);

export const cloneWithShuffledChoices = (question: QuizQuestion) => ({
  ...question,
  choices: shuffle(question.choices)
});
