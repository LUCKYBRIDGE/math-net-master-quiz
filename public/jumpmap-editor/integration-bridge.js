(function initJumpmapIntegrationBridge() {
  const clamp = (value, min, max, fallback) => {
    const num = Number(value);
    const base = Number.isFinite(num) ? num : fallback;
    return Math.min(max, Math.max(min, base));
  };

  const createEventBus = () => {
    const listeners = new Set();

    const emit = (event, payload = {}) => {
      listeners.forEach((listener) => {
        try {
          listener({ event, payload, at: Date.now() });
        } catch (error) {
          console.error('[JumpmapBridge listener error]', error);
        }
      });
    };

    const on = (listener) => {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    return { emit, on };
  };

  const createNoopQuizGateway = () => ({
    requestQuiz: async () => ({
      accepted: false,
      reason: 'quiz_gateway_not_connected'
    })
  });

  const createBridge = (options = {}) => {
    const minGauge = Number.isFinite(Number(options.minGauge)) ? Number(options.minGauge) : 0;
    const maxGauge = Number.isFinite(Number(options.maxGauge)) ? Number(options.maxGauge) : 100;
    let gauge = clamp(options.initialGauge, minGauge, maxGauge, maxGauge);
    let quizGateway = options.quizGateway && typeof options.quizGateway.requestQuiz === 'function'
      ? options.quizGateway
      : createNoopQuizGateway();
    const { emit, on } = createEventBus();

    const snapshot = () => ({
      gauge,
      minGauge,
      maxGauge
    });

    const setGauge = (value, meta = {}) => {
      const next = clamp(value, minGauge, maxGauge, gauge);
      if (next === gauge) return snapshot();
      const prev = gauge;
      gauge = next;
      emit('gauge:changed', { prev, next, ...meta });
      return snapshot();
    };

    const consumeGauge = (amount, meta = {}) => {
      const next = clamp(gauge - Math.max(0, Number(amount) || 0), minGauge, maxGauge, gauge);
      const changed = next !== gauge;
      const prev = gauge;
      gauge = next;
      if (changed) emit('gauge:changed', { prev, next, mode: 'consume', ...meta });
      if (gauge <= minGauge + 1e-6) emit('gauge:empty', { ...meta });
      return { allowed: gauge > minGauge + 1e-6, ...snapshot() };
    };

    const refillGauge = (amount, meta = {}) => {
      const next = clamp(gauge + Math.max(0, Number(amount) || 0), minGauge, maxGauge, gauge);
      const prev = gauge;
      gauge = next;
      if (next !== prev) emit('gauge:changed', { prev, next, mode: 'refill', ...meta });
      return snapshot();
    };

    const setQuizGateway = (nextGateway) => {
      if (nextGateway && typeof nextGateway.requestQuiz === 'function') {
        quizGateway = nextGateway;
      }
      return quizGateway;
    };

    const requestQuiz = async (payload = {}) => {
      emit('quiz:requested', payload);
      try {
        const result = await quizGateway.requestQuiz(payload);
        emit('quiz:resolved', result || {});
        return result;
      } catch (error) {
        emit('quiz:failed', { message: error?.message || 'unknown_error' });
        return { accepted: false, reason: 'quiz_gateway_error' };
      }
    };

    return {
      on,
      emit,
      snapshot,
      getGauge: () => gauge,
      setGauge,
      consumeGauge,
      refillGauge,
      requestQuiz,
      setQuizGateway
    };
  };

  window.JumpmapIntegrationBridge = {
    createBridge,
    createNoopQuizGateway
  };
})();

