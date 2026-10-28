// The selection and the arithmetic the compact controls share: a clamped
// index over a list, a stepped value, a cycle through choices. No host and
// no JSX, so a test reads them as they are.

import { createMemo, createSignal, type Accessor } from "solid-js";

export interface Selection {
  index: Accessor<number>;
  set(index: number): void;
  /** True when the index moved. */
  move(delta: number): boolean;
  count: Accessor<number>;
}

/** A clamped index over `count` items; the index follows a shrinking list. */
export function createSelection(count: Accessor<number>, initial = 0): Selection {
  const [raw, setRaw] = createSignal(initial);
  const index = createMemo(() => Math.max(0, Math.min(raw(), count() - 1)));
  return {
    index,
    count,
    set: value => setRaw(Math.max(0, Math.min(value, Math.max(0, count() - 1)))),
    move: delta => {
      const next = Math.max(0, Math.min(index() + delta, count() - 1));
      if (next === index()) return false;
      setRaw(next);
      return true;
    },
  };
}

/** A number stepped by `step` (and `fineStep` with Shift) inside a range,
 *  rounded to the step's decimals. */
export function stepValue(value: number, direction: -1 | 1, step: number, min: number, max: number, fine = false, fineStep = step / 10): number {
  const used = fine ? fineStep : step;
  const next = value + direction * used;
  const decimals = Math.max(0, Math.ceil(-Math.log10(used)));
  return Math.max(min, Math.min(max, Number(next.toFixed(decimals))));
}

/** The next entry of a cycle in `direction`. */
export function cycle<T>(items: readonly T[], current: T, direction: -1 | 1): T {
  const at = items.indexOf(current);
  const next = (at + direction + items.length) % items.length;
  return items[next]!;
}
