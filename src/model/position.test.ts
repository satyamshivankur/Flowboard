import { describe, expect, it } from "vitest";

import { POSITION_GAP, POSITION_MIN_GAP } from "@/config/limits";

import {
  groupNeedsRebalance,
  needsRebalance,
  positionAtEnd,
  positionAtStart,
  positionBetween,
  positionForIndex,
  rebalance,
  sortByPosition,
} from "./position";

describe("positionBetween", () => {
  it("returns the first position for an empty group", () => {
    expect(positionBetween(null, null)).toBe(POSITION_GAP);
  });

  it("prepends below the first item", () => {
    expect(positionBetween(null, POSITION_GAP)).toBe(0);
    expect(positionBetween(null, 500)).toBeLessThan(500);
  });

  it("appends above the last item", () => {
    expect(positionBetween(POSITION_GAP, null)).toBe(POSITION_GAP * 2);
  });

  it("takes the midpoint between two neighbours", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(0, 1)).toBe(0.5);
  });

  it("always lands strictly between its neighbours", () => {
    const pairs: [number, number][] = [
      [0, 1],
      [1024, 2048],
      [-500, 500],
      [0.1, 0.2],
    ];

    for (const [prev, next] of pairs) {
      const result = positionBetween(prev, next);
      expect(result).toBeGreaterThan(prev);
      expect(result).toBeLessThan(next);
    }
  });
});

describe("needsRebalance", () => {
  it("is false at the edges, where there is always room", () => {
    expect(needsRebalance(null, 1000)).toBe(false);
    expect(needsRebalance(1000, null)).toBe(false);
    expect(needsRebalance(null, null)).toBe(false);
  });

  it("is false for a healthy gap", () => {
    expect(needsRebalance(1000, 2000)).toBe(false);
  });

  it("is true once the gap collapses below usable precision", () => {
    expect(needsRebalance(1000, 1000 + POSITION_MIN_GAP / 2)).toBe(true);
  });

  /*
   * The scenario the scheme actually has to survive: a user repeatedly dropping
   * a card into the same slot. Each drop halves the gap, so precision is
   * exhausted in tens of operations rather than thousands.
   */
  it("detects exhaustion after repeated midpoint insertion at one spot", () => {
    const prev = 0;
    let next = POSITION_GAP;
    let insertions = 0;

    while (!needsRebalance(prev, next) && insertions < 100) {
      next = positionBetween(prev, next);
      insertions += 1;
    }

    expect(needsRebalance(prev, next)).toBe(true);
    expect(insertions).toBeLessThan(100);
  });
});

describe("rebalance", () => {
  it("produces evenly spaced, ascending positions", () => {
    const positions = rebalance(4);

    expect(positions).toEqual([
      POSITION_GAP,
      POSITION_GAP * 2,
      POSITION_GAP * 3,
      POSITION_GAP * 4,
    ]);
  });

  it("returns an empty array for an empty group", () => {
    expect(rebalance(0)).toEqual([]);
  });

  it("restores room between every neighbour", () => {
    const positions = rebalance(10);

    for (let index = 1; index < positions.length; index += 1) {
      expect(
        needsRebalance(positions[index - 1] ?? null, positions[index] ?? null),
      ).toBe(false);
    }
  });
});

describe("sortByPosition", () => {
  it("orders by position ascending", () => {
    const items = [
      { id: "c", position: 3000 },
      { id: "a", position: 1000 },
      { id: "b", position: 2000 },
    ];

    expect(sortByPosition(items).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  /*
   * Equal positions should not render in whatever order Object.values happens
   * to produce — that varies with insertion history and would surface as a
   * flaky test that looks like a logic bug.
   */
  it("breaks ties deterministically on id", () => {
    const items = [
      { id: "b", position: 1000 },
      { id: "a", position: 1000 },
    ];

    expect(sortByPosition(items).map((item) => item.id)).toEqual(["a", "b"]);
    expect(sortByPosition([...items].reverse()).map((item) => item.id)).toEqual(
      ["a", "b"],
    );
  });

  it("does not mutate its input", () => {
    const items = [
      { id: "b", position: 2000 },
      { id: "a", position: 1000 },
    ];

    sortByPosition(items);

    expect(items[0]?.id).toBe("b");
  });
});

describe("positionForIndex", () => {
  const sorted = [{ position: 1000 }, { position: 2000 }, { position: 3000 }];

  it("resolves a drop at the head", () => {
    expect(positionForIndex(sorted, 0)).toBeLessThan(1000);
  });

  it("resolves a drop in the middle", () => {
    expect(positionForIndex(sorted, 1)).toBe(1500);
    expect(positionForIndex(sorted, 2)).toBe(2500);
  });

  it("resolves a drop at the tail", () => {
    expect(positionForIndex(sorted, 3)).toBeGreaterThan(3000);
  });

  it("clamps an out-of-range index rather than producing NaN", () => {
    expect(Number.isFinite(positionForIndex(sorted, -5))).toBe(true);
    expect(Number.isFinite(positionForIndex(sorted, 99))).toBe(true);
    expect(positionForIndex(sorted, -5)).toBe(positionForIndex(sorted, 0));
    expect(positionForIndex(sorted, 99)).toBe(positionForIndex(sorted, 3));
  });

  it("handles an empty group", () => {
    expect(positionForIndex([], 0)).toBe(POSITION_GAP);
  });
});

describe("positionAtStart and positionAtEnd", () => {
  it("bracket an existing group", () => {
    const sorted = [{ position: 1000 }, { position: 2000 }];

    expect(positionAtStart(sorted)).toBeLessThan(1000);
    expect(positionAtEnd(sorted)).toBeGreaterThan(2000);
  });

  it("agree on the first position for an empty group", () => {
    expect(positionAtStart([])).toBe(POSITION_GAP);
    expect(positionAtEnd([])).toBe(POSITION_GAP);
  });
});

describe("groupNeedsRebalance", () => {
  it("reports when the slot at an index has collapsed", () => {
    const tight = [
      { position: 1000 },
      { position: 1000 + POSITION_MIN_GAP / 4 },
    ];

    expect(groupNeedsRebalance(tight, 1)).toBe(true);
    // The edges always have room.
    expect(groupNeedsRebalance(tight, 0)).toBe(false);
    expect(groupNeedsRebalance(tight, 2)).toBe(false);
  });
});
