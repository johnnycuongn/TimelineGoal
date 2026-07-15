import {
  BEHAVIORS,
  behaviorDuration,
  clampToStage,
  neutralOsc,
  neutralTarget,
  nextGap,
  pickBehavior,
  resetOsc,
  resetTarget,
  STAGE,
  type Pool,
} from './pupBehaviors';

const POOLS: Pool[] = ['neutral', 'sad', 'nap'];

describe('behavior table', () => {
  it('every behavior is well-formed', () => {
    for (const [name, def] of Object.entries(BEHAVIORS)) {
      expect(def.weight).toBeGreaterThan(0);
      expect(def.durMin).toBeGreaterThan(0);
      expect(def.durMax).toBeGreaterThanOrEqual(def.durMin);
      expect(POOLS).toContain(def.pool);
      expect(typeof def.run).toBe('function');
      expect(name).toBe(name.trim());
    }
  });

  it('each pool has at least one behavior', () => {
    for (const pool of POOLS) {
      expect(Object.values(BEHAVIORS).some((d) => d.pool === pool)).toBe(true);
    }
  });

  it('run() never throws and only writes finite numbers across its timeline', () => {
    for (const def of Object.values(BEHAVIORS)) {
      const params = def.init?.(() => 0.5) ?? {};
      for (let k = 0; k <= 1.0001; k += 0.1) {
        const T = neutralTarget();
        const O = neutralOsc();
        expect(() => def.run(k, params, T, O)).not.toThrow();
        for (const v of [...Object.values(T), ...Object.values(O)]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });
});

describe('pickBehavior', () => {
  it('returns a name from the requested pool', () => {
    for (const pool of POOLS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const name = pickBehavior(pool, () => r);
        expect(BEHAVIORS[name].pool).toBe(pool);
      }
    }
  });

  it('rand→0 picks the first behavior in the pool, rand→~1 the last', () => {
    const neutralNames = Object.keys(BEHAVIORS).filter((n) => BEHAVIORS[n].pool === 'neutral');
    expect(pickBehavior('neutral', () => 0)).toBe(neutralNames[0]);
    expect(pickBehavior('neutral', () => 0.999999)).toBe(neutralNames[neutralNames.length - 1]);
  });
});

describe('behaviorDuration', () => {
  it('stays within the declared range', () => {
    for (const name of Object.keys(BEHAVIORS)) {
      const def = BEHAVIORS[name];
      expect(behaviorDuration(name, () => 0)).toBeCloseTo(def.durMin);
      expect(behaviorDuration(name, () => 1)).toBeCloseTo(def.durMax);
    }
  });
});

describe('nextGap', () => {
  it('is always a positive, bounded pause', () => {
    for (const pool of POOLS) {
      expect(nextGap(pool, () => 0)).toBeGreaterThan(0);
      expect(nextGap(pool, () => 1)).toBeLessThanOrEqual(4);
    }
  });
});

describe('clampToStage', () => {
  it('keeps the pup on the mat', () => {
    expect(clampToStage(99, 99)).toEqual({ x: STAGE.x, z: STAGE.z });
    expect(clampToStage(-99, -99)).toEqual({ x: -STAGE.x, z: -STAGE.z });
    expect(clampToStage(0.1, -0.1)).toEqual({ x: 0.1, z: -0.1 });
  });
});

describe('reset helpers', () => {
  it('resetTarget zeroes every field', () => {
    const T = neutralTarget();
    T.yaw = 1;
    T.sink = 1;
    resetTarget(T);
    expect(T).toEqual(neutralTarget());
  });
  it('resetOsc restores neutral amplitudes', () => {
    const O = neutralOsc();
    O.wagAmp = 1;
    O.breath = 5;
    resetOsc(O);
    expect(O).toEqual(neutralOsc());
  });
});
