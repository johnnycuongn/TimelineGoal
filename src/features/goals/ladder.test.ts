import {
  childUnits,
  completedWeeks,
  goalComplete,
  goalDone,
  goalsForPeriod,
  isSealed,
  pendingSeals,
  rollup,
  weeklyPulse,
  weeklyStreak,
  type GoalLike,
} from './ladder';

const A = 'alice_uid';
const B = 'bob_uid';

function goal(overrides: Partial<GoalLike> & { id: string }): GoalLike {
  return {
    horizon: 'week',
    owner: 'shared',
    period: '2026-W28',
    targetUnits: 3,
    ...overrides,
  };
}

describe('goal progress from denormalized counters', () => {
  it('sums both partners and treats missing counters as zero', () => {
    expect(goalDone(goal({ id: 'g' }))).toBe(0);
    expect(goalDone(goal({ id: 'g', progressBy: { [A]: 2, [B]: 1 } }))).toBe(3);
    expect(goalComplete(goal({ id: 'g', progressBy: { [A]: 2, [B]: 1 } }))).toBe(true);
    expect(goalComplete(goal({ id: 'g', progressBy: { [A]: 2 } }))).toBe(false);
  });

  it('caps a child contribution at one full unit', () => {
    expect(childUnits(goal({ id: 'g', targetUnits: 4, progressBy: { [A]: 2 } }))).toBe(0.5);
    expect(childUnits(goal({ id: 'g', targetUnits: 2, progressBy: { [A]: 5 } }))).toBe(1);
    expect(childUnits(goal({ id: 'g', targetUnits: 0 }))).toBe(0);
  });
});

describe('rollup — small taps feed the big dream', () => {
  const quarter = goal({ id: 'q1', horizon: 'quarter', period: '2026-Q3', targetUnits: 4 });

  it('earns fractional units from children as they fill', () => {
    const all = [
      quarter,
      goal({ id: 'w1', parentGoalId: 'q1', targetUnits: 2, progressBy: { [A]: 1 } }), // half
      goal({ id: 'w2', parentGoalId: 'q1', targetUnits: 3, progressBy: { [A]: 3 } }), // full
      goal({ id: 'w3', parentGoalId: 'other', targetUnits: 3, progressBy: { [A]: 3 } }),
    ];
    const r = rollup(quarter, all);
    expect(r.children.map((c) => c.id)).toEqual(['w1', 'w2']);
    expect(r.done).toBeCloseTo(1.5);
    expect(r.fraction).toBeCloseTo(1.5 / 4);
    expect(r.complete).toBe(false);
  });

  it('counts direct check-ins on the parent alongside children', () => {
    const parent = { ...quarter, progressBy: { [B]: 2 } };
    const all = [parent, goal({ id: 'w1', parentGoalId: 'q1', targetUnits: 1, progressBy: { [A]: 1 } })];
    expect(rollup(parent, all).done).toBeCloseTo(3);
  });

  it('caps at the target and marks complete despite float thirds', () => {
    const parent = goal({ id: 'q2', horizon: 'quarter', period: '2026-Q3', targetUnits: 1 });
    const thirds = [1, 2, 3].map((i) =>
      goal({ id: `w${i}`, parentGoalId: 'q2', targetUnits: 3, progressBy: { [A]: 1 } }),
    );
    // three × ⅓ from partially-filled children — but capped at target 1
    const r = rollup(parent, [parent, ...thirds]);
    expect(r.done).toBe(1);
    expect(r.complete).toBe(true);
  });

  it('handles a parent with no children yet', () => {
    const r = rollup(quarter, [quarter]);
    expect(r.done).toBe(0);
    expect(r.complete).toBe(false);
    expect(r.children).toEqual([]);
  });
});

describe('goalsForPeriod', () => {
  it('filters by horizon and period', () => {
    const goals = [
      goal({ id: 'a' }),
      goal({ id: 'b', period: '2026-W27' }),
      goal({ id: 'c', horizon: 'quarter', period: '2026-Q3' }),
    ];
    expect(goalsForPeriod(goals, 'week', '2026-W28').map((g) => g.id)).toEqual(['a']);
    expect(goalsForPeriod(goals, 'quarter', '2026-Q3').map((g) => g.id)).toEqual(['c']);
  });
});

describe('streak doodles — kind week completion', () => {
  it('lights a week when at least one goal filled', () => {
    const done = completedWeeks([
      goal({ id: 'a', period: '2026-W27', targetUnits: 2, progressBy: { [A]: 2 } }),
      goal({ id: 'b', period: '2026-W27', targetUnits: 5 }), // unfinished, same week — still counts
      goal({ id: 'c', period: '2026-W28', targetUnits: 2, progressBy: { [A]: 1 } }),
      goal({ id: 'q', horizon: 'quarter', period: '2026-Q3', targetUnits: 1, progressBy: { [A]: 1 } }),
    ]);
    expect(done).toEqual(new Set(['2026-W27']));
  });

  it('counts consecutive weeks and forgives the in-progress current week', () => {
    const completed = new Set(['2026-W25', '2026-W26', '2026-W27']);
    expect(weeklyStreak(completed, '2026-W28')).toBe(3); // this week not done yet — streak holds
    expect(weeklyStreak(new Set([...completed, '2026-W28']), '2026-W28')).toBe(4);
    expect(weeklyStreak(new Set(['2026-W25']), '2026-W28')).toBe(0); // gap at W26/27
    expect(weeklyStreak(new Set(), '2026-W28')).toBe(0);
  });

  it('walks streaks across a year boundary', () => {
    // 2025 has 52 ISO weeks, so W52 → 2026-W01 is consecutive.
    const completed = new Set(['2025-W51', '2025-W52', '2026-W01']);
    expect(weeklyStreak(completed, '2026-W02')).toBe(3);
  });
});

describe('weekly pulse ring', () => {
  it('splits the week by partner and sums targets', () => {
    const goals = [
      goal({ id: 'a', targetUnits: 3, progressBy: { [A]: 2, [B]: 1 } }),
      goal({ id: 'b', targetUnits: 2, owner: A, progressBy: { [A]: 1 } }),
      goal({ id: 'old', period: '2026-W27', targetUnits: 9, progressBy: { [B]: 9 } }),
    ];
    const pulse = weeklyPulse(goals, '2026-W28', [A, B]);
    expect(pulse.byUid).toEqual({ [A]: 3, [B]: 1 });
    expect(pulse.targetTotal).toBe(5);
  });

  it('gives an empty week a zeroed pulse', () => {
    expect(weeklyPulse([], '2026-W28', [A, B])).toEqual({
      byUid: { [A]: 0, [B]: 0 },
      targetTotal: 0,
    });
  });
});

describe('seal-the-deal', () => {
  it('is sealed only once both paws are in the wax', () => {
    expect(isSealed(goal({ id: 'g' }))).toBe(false);
    expect(isSealed(goal({ id: 'g', seals: { [A]: 1 } }))).toBe(false);
    expect(isSealed(goal({ id: 'g', seals: { [A]: 1, [B]: 2 } }))).toBe(true);
  });

  it('nudges only current-period shared goals missing MY seal', () => {
    const goals = [
      goal({ id: 'mine-to-seal', seals: { [B]: 1 } }),
      goal({ id: 'fresh' }), // nobody sealed yet — still needs my paw
      goal({ id: 'sealed', seals: { [A]: 1, [B]: 2 } }),
      goal({ id: 'i-did', seals: { [A]: 1 } }),
      goal({ id: 'personal', owner: A }),
      goal({ id: 'last-week', period: '2026-W27', seals: { [B]: 1 } }), // archived quietly
    ];
    const pending = pendingSeals(goals, A, ['2026-W28', '2026-Q3', '2026']);
    expect(pending.map((g) => g.id)).toEqual(['mine-to-seal', 'fresh']);
  });
});
