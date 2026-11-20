import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { score, activityPoints, type ScoreInput, type Status } from "../src/score.js";

const status = fc.constantFrom<Status>("fulfilled", "partial", "missing", "unknown");
const known = fc.constantFrom<Status>("fulfilled", "partial", "missing");

const input: fc.Arbitrary<ScoreInput> = fc.record({
  daysInactive: fc.option(fc.integer({ min: -50, max: 3000 }), { nil: null }),
  testFiles: fc.integer({ min: 0, max: 20 }),
  ci: fc.boolean(),
  buildScript: fc.boolean(),
  checkVerified: fc.boolean(),
  lockfile: fc.boolean(),
  direct: fc.integer({ min: 0, max: 50 }),
  unpinned: fc.integer({ min: 0, max: 50 }),
  truncated: fc.boolean(),
  readme: fc.boolean(),
  readmeChars: fc.integer({ min: 0, max: 5000 }),
  license: fc.boolean(),
  description: fc.boolean(),
  promises: fc.array(status, { maxLength: 6 }),
});

const base: ScoreInput = {
  daysInactive: 0, testFiles: 0, ci: false, buildScript: false, checkVerified: false, lockfile: false,
  direct: 1, unpinned: 0, truncated: false, readme: false, readmeChars: 0, license: false, description: false,
  promises: [],
};

describe("reference cases", () => {
  it("a perfect repo scores 100", () => {
    const s = score({
      ...base, testFiles: 3, ci: true, buildScript: true, checkVerified: true, lockfile: true,
      readme: true, readmeChars: 500, license: true, description: true,
      promises: ["fulfilled", "fulfilled"],
    });
    expect(s.base).toBe(75);
    expect(s.gap.points).toBe(25);
    expect(s.final).toBe(100);
  });

  it("the synthetic fixture shape stays provisional", () => {
    const s = score({
      ...base, daysInactive: 982, lockfile: false, unpinned: 2, direct: 2, readme: true, readmeChars: 250,
      description: true, promises: ["unknown", "unknown", "unknown", "unknown"],
    });
    expect(s.components.activity).toBe(0);
    expect(s.components.clarity).toBe(8);
    expect(s.base).toBe(8);
    expect(s.provisional).toBe(true);
    expect(s.final).toBeNull();
  });

  it("rounds the gap to one decimal", () => {
    const s = score({ ...base, promises: ["fulfilled", "partial", "missing"] });
    expect(s.gap.points).toBe(12.5);
  });

  it("activity bands", () => {
    expect([0, 30, 31, 90, 91, 180, 181, 365, 366].map(activityPoints)).toEqual([15, 15, 12, 12, 8, 8, 4, 4, 0]);
    expect(activityPoints(-5)).toBe(15);
    expect(activityPoints(null)).toBe(0);
  });
});

describe("properties", () => {
  it("P1 base and final stay in bounds", () =>
    fc.assert(fc.property(input, (i) => {
      const s = score(i);
      expect(s.base).toBeGreaterThanOrEqual(0);
      expect(s.base).toBeLessThanOrEqual(75);
      if (s.final !== null) {
        expect(s.final).toBeGreaterThanOrEqual(0);
        expect(s.final).toBeLessThanOrEqual(100);
      }
    })));

  it("P2 older activity cannot earn more", () =>
    fc.assert(fc.property(fc.integer({ min: 0, max: 4000 }), fc.integer({ min: 0, max: 4000 }), (a, b) => {
      const [young, old] = a <= b ? [a, b] : [b, a];
      expect(activityPoints(old)).toBeLessThanOrEqual(activityPoints(young));
    })));

  it("P3 adding a positive integrity signal cannot lower the score", () =>
    fc.assert(fc.property(input, fc.constantFrom("tests", "ci", "build"), (i, which) => {
      const better: ScoreInput = {
        ...i,
        testFiles: which === "tests" ? Math.max(1, i.testFiles) : i.testFiles,
        ci: which === "ci" ? true : i.ci,
        buildScript: which === "build" ? true : i.buildScript,
      };
      const a = score(i), b = score(better);
      expect(b.base).toBeGreaterThanOrEqual(a.base);
      if (a.final !== null) expect(b.final!).toBeGreaterThanOrEqual(a.final);
    })));

  it("P4 upgrading a known promise cannot lower gap points", () =>
    fc.assert(fc.property(fc.array(known, { minLength: 1, maxLength: 6 }), fc.nat(), (list, k) => {
      const idx = k % list.length;
      const order: Status[] = ["missing", "partial", "fulfilled"];
      const up = [...list];
      const cur = order.indexOf(up[idx]!);
      up[idx] = order[Math.min(2, cur + 1)]!;
      const a = score({ ...base, promises: list }).gap.points!;
      const b = score({ ...base, promises: up }).gap.points!;
      expect(b).toBeGreaterThanOrEqual(a);
    })));

  it("P5 identical inputs give identical output", () =>
    fc.assert(fc.property(input, (i) => {
      expect(score({ ...i })).toEqual(score({ ...i }));
    })));

  it("P6 absent or incomplete promise evidence stays provisional", () =>
    fc.assert(fc.property(input, (i) => {
      const s = score(i);
      const incomplete = i.promises.length === 0 || i.promises.includes("unknown");
      expect(s.provisional).toBe(incomplete);
      if (incomplete) {
        expect(s.final).toBeNull();
        expect(s.gap.points).toBeNull();
      }
    })));

  it("P7 a missing check earns no passing-check points", () =>
    fc.assert(fc.property(input, (i) => {
      const s = score({ ...i, checkVerified: false });
      expect(s.components.integrity.check).toBe(0);
      expect(s.components.integrity.total).toBeLessThanOrEqual(15);
    })));
});
