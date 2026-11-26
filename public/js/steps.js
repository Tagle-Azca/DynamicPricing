// Accordion state: exactly one step is open; finishing a step marks it done and opens the next.
export function createSteps(count = 3) {
  let current = 0;
  let done = Array(count).fill(false);
  return {
    current: () => current,
    open(i) {
      if (i >= 0 && i < count) current = i;
    },
    advance(i) {
      done[i] = true;
      current = Math.min(i + 1, count - 1);
    },
    // 'active' | 'done' | 'upcoming' for each step
    states: () => done.map((d, i) => (i === current ? 'active' : d ? 'done' : 'upcoming')),
    reset() {
      current = 0;
      done = Array(count).fill(false);
    },
  };
}
