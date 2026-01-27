export const buildWeightedQuestionBank = (banks, settings) => {
  const distributeCounts = (total, weights) => {
    const weightSum = weights.reduce((sum, w) => sum + w.weight, 0);
    if (!weightSum) return weights.map(w => ({ key: w.key, count: 0 }));
    const base = weights.map(w => {
      const exact = (w.weight / weightSum) * total;
      return { key: w.key, exact, count: Math.floor(exact) };
    });
    let remaining = total - base.reduce((sum, item) => sum + item.count, 0);
    base.sort((a, b) => (b.exact - b.count) - (a.exact - a.count));
    for (let i = 0; i < base.length && remaining > 0; i += 1) {
      base[i].count += 1;
      remaining -= 1;
    }
    return base.map(item => ({ key: item.key, count: item.count }));
  };

  const configs = Object.entries(settings.questionTypes || {}).map(([key, config]) => ({
    key,
    enabled: config.enabled,
    weight: config.weight
  }));

  let enabled = configs.filter(item => item.enabled && item.weight > 0);
  if (enabled.length === 0) {
    enabled = [{ key: 'facecolor', enabled: true, weight: 100 }];
  }

  const total = settings.questionCount;
  const counts = distributeCounts(total, enabled);
  const selected = [];
  const pools = {};

  enabled.forEach(item => {
    const bank = banks[item.key];
    if (!bank) return;
    pools[item.key] = bank.questions.slice().sort(() => Math.random() - 0.5);
  });

  let remaining = total;
  counts.forEach(({ key, count }) => {
    const pool = pools[key] || [];
    const take = Math.min(count, pool.length);
    selected.push(...pool.slice(0, take));
    pools[key] = pool.slice(take);
    remaining -= take;
  });

  if (remaining > 0) {
    const fallback = Object.values(pools).flat();
    const extra = fallback.slice(0, remaining);
    selected.push(...extra);
    remaining -= extra.length;
  }

  if (remaining > 0 && !settings.avoidRepeat) {
    const all = Object.values(banks).flatMap(bank => bank.questions);
    while (remaining > 0 && all.length > 0) {
      selected.push(all[Math.floor(Math.random() * all.length)]);
      remaining -= 1;
    }
  }

  const finalQuestions = settings.selectionMode === 'random'
    ? selected.sort(() => Math.random() - 0.5)
    : selected;

  return { questions: finalQuestions };
};
