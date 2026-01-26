import type { QuizEvent, QuizEventListener } from './types';

export const createEventBus = () => {
  const listeners = new Set<QuizEventListener>();

  const emit = (event: QuizEvent) => {
    listeners.forEach(listener => listener(event));
  };

  const on = (listener: QuizEventListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { emit, on };
};
