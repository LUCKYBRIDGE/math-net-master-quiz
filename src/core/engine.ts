import type { AnswerResult, QuizEvent, QuizQuestion, QuizStateSnapshot, QuizSettings } from './types';
import { buildRandomQueue, cloneWithShuffledChoices } from './selection';
import { computeScore } from './scoring';
import { createEventBus } from './events';

export interface QuizEngineOptions {
  questionBank: { questions: QuizQuestion[] };
  settings: QuizSettings;
}

export interface QuizEngine {
  nextQuestion: () => QuizQuestion | null;
  submitAnswer: (choice: string) => AnswerResult | null;
  getState: () => QuizStateSnapshot;
  reset: () => void;
  onEvent: (listener: (event: QuizEvent) => void) => () => void;
}

const clampTotalQuestions = (settings: QuizSettings, totalQuestions: number) => {
  if (settings.selectionMode === 'sequential' || settings.avoidRepeat) {
    return Math.min(settings.questionCount, totalQuestions);
  }
  return settings.questionCount;
};

export const createQuizEngine = (options: QuizEngineOptions): QuizEngine => {
  const { questionBank, settings } = options;
  const { emit, on } = createEventBus();

  const questions = questionBank.questions.slice();
  const totalLimit = clampTotalQuestions(settings, questions.length);

  let queue = settings.selectionMode === 'random' && settings.avoidRepeat
    ? buildRandomQueue(questions)
    : questions.slice();
  let index = 0;
  let askedCount = 0;
  let answeredCount = 0;
  let correctCount = 0;
  let totalScore = 0;
  let combo = 0;
  let currentQuestion: QuizQuestion | undefined;
  let questionStartTime = 0;

  const getNextFromQueue = () => {
    if (settings.selectionMode === 'random') {
      if (settings.avoidRepeat) return queue.shift();
      const pick = queue[Math.floor(Math.random() * queue.length)];
      return pick;
    }
    const next = queue[index];
    index += 1;
    return next;
  };

  const reset = () => {
    queue = settings.selectionMode === 'random' && settings.avoidRepeat
      ? buildRandomQueue(questions)
      : questions.slice();
    index = 0;
    askedCount = 0;
    answeredCount = 0;
    correctCount = 0;
    totalScore = 0;
    combo = 0;
    currentQuestion = undefined;
    questionStartTime = 0;
  };

  const nextQuestion = () => {
    if (askedCount >= totalLimit) return null;
    const next = getNextFromQueue();
    if (!next) return null;
    askedCount += 1;
    currentQuestion = settings.shuffleChoices ? cloneWithShuffledChoices(next) : { ...next };
    questionStartTime = Date.now();
    emit({ type: 'question', payload: currentQuestion });
    return currentQuestion;
  };

  const submitAnswer = (choice: string) => {
    if (!currentQuestion) return null;
    const timeMs = Math.max(0, Date.now() - questionStartTime);
    const correct = choice === currentQuestion.answer;
    const { scoreDelta, nextCombo } = computeScore(correct, timeMs, combo, settings);

    totalScore += scoreDelta;
    combo = nextCombo;
    answeredCount += 1;
    if (correct) correctCount += 1;

    const result: AnswerResult = {
      correct,
      timeMs,
      questionId: currentQuestion.id,
      scoreDelta,
      totalScore,
      combo,
      difficulty: currentQuestion.difficulty
    };

    emit({ type: 'answer', payload: result });

    if (answeredCount >= totalLimit) {
      emit({ type: 'finish', payload: { totalScore, correctCount, totalCount: answeredCount } });
    }

    currentQuestion = undefined;
    return result;
  };

  const getState = (): QuizStateSnapshot => ({
    settings,
    totalScore,
    combo,
    answeredCount,
    correctCount,
    currentQuestion,
    remainingQuestions: Math.max(0, totalLimit - answeredCount)
  });

  return {
    nextQuestion,
    submitAnswer,
    getState,
    reset,
    onEvent: on
  };
};
