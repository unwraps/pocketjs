// Pieces the tools share beyond the kit: the section tabs a scene switches
// with left and right, and a blink signal for recording dots.

import { createSignal, Index, type Accessor } from "solid-js";
import { Text, View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { COLOR, GUTTER, measure, SLOT } from "@pocketjs/framework/compact";

export interface TabsProps {
  items: readonly string[];
  active: Accessor<number>;
  y?: number;
}

/** Section names in a row; the active one is filled with the accent. */
export function Tabs(props: TabsProps) {
  const y = props.y ?? 3;
  let x = GUTTER;
  const placed = props.items.map(item => {
    const w = Math.ceil(measure(item, SLOT.tinyBold)) + 10;
    const at = x;
    x += w + 4;
    return { item, x: at, w };
  });
  return (
    <View class="absolute left-0 w-[320] h-[12]" style={{ insetT: y }}>
      <Index each={placed}>
        {(tab, i) => (
          <View class="absolute rounded-sm" style={{ insetL: tab().x, insetT: 0, width: tab().w, height: 12, bgColor: props.active() === i ? COLOR.accent : COLOR.panel }}>
            <Text class="absolute left-0 top-0 text-2xs font-bold leading-[12] text-center" style={{ width: tab().w, textColor: props.active() === i ? COLOR.accentInk : COLOR.dim }}>
              {tab().item}
            </Text>
          </View>
        )}
      </Index>
    </View>
  );
}

/** True half a second, false half a second. */
export function createBlink(): Accessor<boolean> {
  const [on, setOn] = createSignal(true);
  const tick = () => {
    setOn(v => !v);
    after(0.5, tick);
  };
  after(0.5, tick);
  return on;
}

/** A clamped ring of the last `size` values. */
export function createHistory(size: number): { values: Accessor<number[]>; push(value: number): void; clear(): void } {
  const [values, setValues] = createSignal<number[]>(Array.from({ length: size }, () => 0));
  return {
    values,
    push: value => setValues(list => [...list.slice(1), value]),
    clear: () => setValues(Array.from({ length: size }, () => 0)),
  };
}
