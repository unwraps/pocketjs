// The compact controls: a focus list, value rows that adjust in place, a
// one-line text field for a hardware keyboard, an action pad, a progress
// bar, a detail block and a panel. Every control is absolutely placed in
// the box its props name, draws its focus as the accent bar and wash, and
// leaves input to the hooks beside it (`useListNav`, `useValueRows`,
// `useActionPad`): a scene composes the two.

import { createMemo, createSignal, For, Index, Show, type Accessor, type JSX } from "solid-js";
import { after } from "../clock.ts";
import { Text, View } from "../primitives.ts";
import { useKey, useNav } from "./app.tsx";
import type { NavEvent } from "./input.ts";
import { ellipsize, measure } from "./text.ts";
import { BUTTON_H, COLOR, CONTENT_W, FOCUS_BAR_W, GUTTER, LINE, RADIUS, ROW_GAP, ROW_H, SLOT, TONE_COLOR, type Tone } from "./tokens.ts";

export interface Box {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

function box(props: Box, defaults: Required<Box>): Required<Box> {
  return { x: props.x ?? defaults.x, y: props.y ?? defaults.y, w: props.w ?? defaults.w, h: props.h ?? defaults.h };
}

// ---- selection ------------------------------------------------------------------

export { createSelection, stepValue, cycle, type Selection } from "./select.ts";
import { type Selection } from "./select.ts";

export interface ListNavOptions {
  onOk?: (index: number) => void;
  onBack?: () => void;
  /** Left and right as page moves of this many rows (default: unused). */
  page?: number;
  /** Other keys of the scene. */
  other?: (event: NavEvent) => boolean | void;
}

/** Up and down move the selection; ok acts on it. */
export function useListNav(selection: Selection, options: ListNavOptions = {}): void {
  useNav(event => {
    switch (event.key) {
      case "up":
        selection.move(-1);
        return true;
      case "down":
        selection.move(1);
        return true;
      case "left":
        if (options.page) {
          selection.move(-options.page);
          return true;
        }
        break;
      case "right":
        if (options.page) {
          selection.move(options.page);
          return true;
        }
        break;
      case "ok":
        options.onOk?.(selection.index());
        return true;
      case "back":
        if (options.onBack) {
          options.onBack();
          return true;
        }
        break;
    }
    return options.other?.(event);
  });
}

// ---- list ----------------------------------------------------------------------

export interface ListProps<T> extends Box {
  items: Accessor<readonly T[]>;
  selection: Selection;
  label: (item: T) => string;
  /** A second, dimmer line; rows grow to hold it. */
  detail?: (item: T) => string;
  /** Right-aligned value on the first line. */
  value?: (item: T) => string;
  /** A dot before the label. */
  dot?: (item: T) => Tone | null;
  /** Shown when the list is empty. */
  empty?: string;
  rowHeight?: number;
}

/** A vertical list with one focused row: the wash, the accent bar at the
 *  left, bold label, dim detail. It scrolls so the focused row shows. */
export function List<T>(props: ListProps<T>): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 136 });
  const rowHeight = props.rowHeight ?? (props.detail ? ROW_H + 8 : ROW_H);
  const stride = rowHeight + ROW_GAP;
  const visible = () => Math.max(1, Math.floor(b().h / stride));
  const [first, setFirst] = createSignal(0);
  createMemo(() => {
    const index = props.selection.index();
    const start = first();
    if (index < start) setFirst(index);
    else if (index >= start + visible()) setFirst(index - visible() + 1);
    const count = props.items().length;
    if (first() > Math.max(0, count - visible())) setFirst(Math.max(0, count - visible()));
  });
  const shown = createMemo(() => props.items().slice(first(), first() + visible()));
  const total = () => props.items().length;
  const barHeight = () => Math.max(6, Math.round((visible() / Math.max(visible(), total())) * b().h));
  const barTop = () => Math.round((first() / Math.max(1, total())) * b().h);
  return (
    <View class="absolute overflow-hidden" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h }}>
      <Show when={total() === 0 && props.empty}>
        <Text class="absolute text-xs leading-[14] text-[#8e80ac]" style={{ insetL: FOCUS_BAR_W + 6, insetT: 4 }}>
          {props.empty}
        </Text>
      </Show>
      <For each={shown()}>
        {(item, i) => {
          const index = () => first() + i();
          const focused = () => props.selection.index() === index();
          const labelWidth = () => b().w - 14 - (props.value ? Math.ceil(measure(props.value!(item), SLOT.xs)) + 10 : 0) - (total() > visible() ? 4 : 0);
          return (
            <View class="absolute left-0 rounded-sm" style={{ insetT: i() * stride, width: b().w - (total() > visible() ? 4 : 0), height: rowHeight, bgColor: focused() ? COLOR.raised : "#00000000" }}>
              <Show when={focused()}>
                <View class="absolute left-0 top-0 rounded-sm bg-[#ffd23f]" style={{ width: FOCUS_BAR_W, height: rowHeight }} />
              </Show>
              <Show when={props.dot?.(item)}>
                {tone => <View class="absolute w-[5] h-[5] rounded-full" style={{ insetL: 7, insetT: 8, bgColor: TONE_COLOR[tone()] }} />}
              </Show>
              <Text class="absolute text-sm font-bold leading-[22]" style={{ insetL: props.dot ? 16 : 8, insetT: 0, textColor: focused() ? COLOR.ink : COLOR.text }}>
                {ellipsize(props.label(item), SLOT.smBold, labelWidth())}
              </Text>
              <Show when={props.value}>
                {value => {
                  const text = () => value()(item);
                  const width = () => Math.ceil(measure(text(), SLOT.xs));
                  return (
                    <Text class="absolute text-xs leading-[22] text-[#a99cc6]" style={{ insetL: b().w - (total() > visible() ? 4 : 0) - 6 - width(), insetT: 0 }}>
                      {text()}
                    </Text>
                  );
                }}
              </Show>
              <Show when={props.detail}>
                {detail => (
                  <Text class="absolute text-2xs leading-[12] text-[#8e80ac]" style={{ insetL: props.dot ? 16 : 8, insetT: 17 }}>
                    {ellipsize(detail()(item), SLOT.tiny, b().w - 14)}
                  </Text>
                )}
              </Show>
            </View>
          );
        }}
      </For>
      <Show when={total() > visible()}>
        <View class="absolute w-[2] bg-[#2b2148]" style={{ insetL: b().w - 2, insetT: 0, height: b().h }} />
        <View class="absolute w-[2] bg-[#8e80ac]" style={{ insetL: b().w - 2, insetT: barTop(), height: barHeight() }} />
      </Show>
    </View>
  );
}

// ---- value rows -------------------------------------------------------------------

export interface ValueRow {
  label: string;
  /** The current value as text; "" draws none. */
  value: () => string;
  /** Left and right change the value; `fine` is Shift held. */
  adjust?: (direction: -1 | 1, fine: boolean) => void;
  /** Ok on the row. */
  press?: () => void;
  /** The value's tone (default ink). */
  tone?: () => Tone;
  /** The row is read-only. */
  disabled?: boolean;
}

export interface ValueRowsProps extends Box {
  rows: Accessor<readonly ValueRow[]>;
  selection: Selection;
}

/** Rows of label and value: a focused row that adjusts shows chevrons round
 *  its value. */
export function ValueRows(props: ValueRowsProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 136 });
  const stride = ROW_H + ROW_GAP;
  const visible = () => Math.max(1, Math.floor(b().h / stride));
  const [first, setFirst] = createSignal(0);
  createMemo(() => {
    const index = props.selection.index();
    if (index < first()) setFirst(index);
    else if (index >= first() + visible()) setFirst(index - visible() + 1);
  });
  const shown = createMemo(() => props.rows().slice(first(), first() + visible()));
  return (
    <View class="absolute overflow-hidden" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h }}>
      <For each={shown()}>
        {(row, i) => {
          const index = () => first() + i();
          const focused = () => props.selection.index() === index();
          const text = () => row.value();
          const width = () => Math.ceil(measure(text(), SLOT.xsBold));
          const chevrons = () => focused() && !!row.adjust && !row.disabled;
          const tone = () => (row.disabled ? COLOR.dim : TONE_COLOR[row.tone?.() ?? "ink"]);
          return (
            <View class="absolute left-0 rounded-sm" style={{ insetT: i() * stride, width: b().w, height: ROW_H, bgColor: focused() ? COLOR.raised : "#00000000" }}>
              <Show when={focused()}>
                <View class="absolute left-0 top-0 rounded-sm bg-[#ffd23f]" style={{ width: FOCUS_BAR_W, height: ROW_H }} />
              </Show>
              <Text class="absolute text-sm leading-[22]" style={{ insetL: 8, insetT: 0, textColor: row.disabled ? COLOR.dim : focused() ? COLOR.ink : COLOR.text }}>
                {row.label}
              </Text>
              <Show when={chevrons()}>
                <Text class="absolute text-xs font-bold leading-[22] text-[#ffd23f]" style={{ insetL: b().w - 6 - width() - 24, insetT: 0 }}>
                  {"<"}
                </Text>
                <Text class="absolute text-xs font-bold leading-[22] text-[#ffd23f]" style={{ insetL: b().w - 6 - 8, insetT: 0 }}>
                  {">"}
                </Text>
              </Show>
              <Text class="absolute text-xs font-bold leading-[22]" style={{ insetL: b().w - 6 - width() - (chevrons() ? 12 : 0), insetT: 0, textColor: focused() && !row.disabled ? (row.adjust ? COLOR.accent : tone()) : tone() }}>
                {text()}
              </Text>
            </View>
          );
        }}
      </For>
    </View>
  );
}

/** Up and down move between rows, left and right adjust the focused row,
 *  ok presses it. */
export function useValueRows(rows: Accessor<readonly ValueRow[]>, selection: Selection, options: { onBack?: () => void; other?: (event: NavEvent) => boolean | void } = {}): void {
  useNav(event => {
    const row = rows()[selection.index()];
    switch (event.key) {
      case "up":
        selection.move(-1);
        return true;
      case "down":
        selection.move(1);
        return true;
      case "left":
        if (row && !row.disabled) row.adjust?.(-1, event.fine);
        return true;
      case "right":
        if (row && !row.disabled) row.adjust?.(1, event.fine);
        return true;
      case "ok":
        if (row && !row.disabled) {
          if (row.press) row.press();
          else row.adjust?.(1, event.fine);
        }
        return true;
      case "back":
        if (options.onBack) {
          options.onBack();
          return true;
        }
        break;
    }
    return options.other?.(event);
  });
}

// ---- text field ---------------------------------------------------------------------

export interface TextFieldProps extends Box {
  value: Accessor<string>;
  /** The field reads the keyboard while true. */
  active: Accessor<boolean>;
  placeholder?: string;
  /** Characters this field accepts; default: printable ASCII. */
  accept?: (ch: string) => boolean;
  maxLength?: number;
  onInput: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
}

/** One line typed on the hardware keyboard: characters append, Backspace
 *  deletes, Enter submits, Escape cancels. The caret blinks twice a second. */
export function TextField(props: TextFieldProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: BUTTON_H + 2 });
  const [blink, setBlink] = createSignal(true);
  const tick = () => {
    setBlink(v => !v);
    after(0.5, tick);
  };
  after(0.5, tick);
  const accept = props.accept ?? ((ch: string) => ch.length === 1 && ch >= " " && ch <= "~");
  useKey(event => {
    if (!props.active()) return;
    if (event.kind === "commit") {
      const text = [...event.text].filter(accept).join("");
      props.onInput((props.value() + text).slice(0, props.maxLength ?? 64));
      return true;
    }
    if (event.kind !== "key") return;
    const key = event.key;
    if (!event.pressed) return key !== "Shift";
    if (key === "Enter") {
      props.onSubmit?.(props.value());
      return true;
    }
    if (key === "Escape") {
      props.onCancel?.();
      return true;
    }
    if (key === "Backspace") {
      props.onInput(props.value().slice(0, -1));
      return true;
    }
    if (key === "Control+u") {
      props.onInput("");
      return true;
    }
    if (accept(key)) {
      if (props.value().length < (props.maxLength ?? 64)) props.onInput(props.value() + key);
      return true;
    }
    // Modifiers and unknown editing keys stay with the field while it types.
    return key === "Shift" || key === "Fn" || key === "CapsLock" || key.includes("Arrow") || key === "Tab";
  });
  const showPlaceholder = () => props.value().length === 0 && !!props.placeholder;
  const textWidth = () => Math.ceil(measure(props.value(), SLOT.xs));
  return (
    <View class="absolute rounded-sm bg-[#231b3b] border" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h, borderColor: props.active() ? COLOR.accent : COLOR.line }}>
      <Text class="absolute text-xs leading-[18]" style={{ insetL: 6, insetT: 1, textColor: showPlaceholder() ? COLOR.dim : COLOR.ink }}>
        {showPlaceholder() ? props.placeholder : ellipsize(props.value(), SLOT.xs, b().w - 16)}
      </Text>
      <Show when={props.active() && blink()}>
        <View class="absolute w-[1] bg-[#ffd23f]" style={{ insetL: 6 + (showPlaceholder() ? 0 : Math.min(textWidth(), b().w - 16)) + 1, insetT: 4, height: b().h - 8 }} />
      </Show>
    </View>
  );
}

// ---- progress and panels -----------------------------------------------------------------

export interface ProgressProps extends Box {
  value: Accessor<number>;
  tone?: Tone;
}

export function Progress(props: ProgressProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 6 });
  const fill = () => Math.round(Math.max(0, Math.min(1, props.value())) * b().w);
  return (
    <View class="absolute rounded-sm bg-[#2b2148]" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h }}>
      <View class="absolute left-0 top-0 rounded-sm" style={{ width: fill(), height: b().h, bgColor: TONE_COLOR[props.tone ?? "ok"] }} />
    </View>
  );
}

export interface PanelProps extends Box {
  title?: string;
  children?: JSX.Element;
  raised?: boolean;
}

/** A rounded box; children are placed inside it. */
export function Panel(props: PanelProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 60 });
  return (
    <View class="absolute rounded-md border" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h, bgColor: props.raised ? COLOR.raised : COLOR.panel, borderColor: COLOR.line }}>
      <Show when={props.title}>
        <Text class="absolute text-2xs font-bold leading-[12] text-[#8e80ac]" style={{ insetL: 6, insetT: 3 }}>
          {props.title}
        </Text>
      </Show>
      {props.children}
    </View>
  );
}

/** A short state word in a small rounded tag: LIVE, FROZEN, REC. */
export function Chip(props: { text: () => string; tone?: () => Tone; x: number; y: number }): JSX.Element {
  const width = () => Math.ceil(measure(props.text(), SLOT.tinyBold)) + 8;
  const tone = () => TONE_COLOR[props.tone?.() ?? "dim"];
  return (
    <View class="absolute rounded-sm border" style={{ insetL: props.x, insetT: props.y, width: width(), height: 12, borderColor: tone() }}>
      <Text class="absolute left-0 top-0 text-2xs font-bold leading-[11] text-center" style={{ width: width(), textColor: tone() }}>
        {props.text()}
      </Text>
    </View>
  );
}

/** Dim label and ink value on one line. */
export function KeyValue(props: { label: string; value: () => string; x: number; y: number; w: number; tone?: () => Tone }): JSX.Element {
  const width = () => Math.ceil(measure(props.value(), SLOT.xs));
  return (
    <View class="absolute" style={{ insetL: props.x, insetT: props.y, width: props.w, height: LINE.xs }}>
      <Text class="absolute left-0 top-0 text-2xs leading-[14] text-[#8e80ac]">{props.label}</Text>
      <Text class="absolute top-0 text-xs leading-[14]" style={{ insetL: props.w - width(), textColor: TONE_COLOR[props.tone?.() ?? "ink"] }}>
        {props.value()}
      </Text>
    </View>
  );
}

// ---- action pad ----------------------------------------------------------------------------

export interface PadAction {
  label: string;
  /** A second, smaller line. */
  sub?: string;
  press: () => void;
  tone?: Tone;
  disabled?: boolean;
}

export interface ActionPadProps extends Box {
  actions: Accessor<readonly PadAction[]>;
  columns: number;
  selection: Selection;
  gap?: number;
}

/** A grid of buttons; the focused one is filled with the accent. */
export function ActionPad(props: ActionPadProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 136 });
  const gap = props.gap ?? 4;
  const rows = () => Math.max(1, Math.ceil(props.actions().length / props.columns));
  const cellW = () => Math.floor((b().w - gap * (props.columns - 1)) / props.columns);
  const cellH = () => Math.floor((b().h - gap * (rows() - 1)) / rows());
  return (
    <View class="absolute" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h }}>
      <Index each={props.actions()}>
        {(action, i) => {
          const focused = () => props.selection.index() === i;
          const col = i % props.columns;
          const row = Math.floor(i / props.columns);
          const tone = () => (action().disabled ? COLOR.dim : TONE_COLOR[action().tone ?? "ink"]);
          return (
            <View class="absolute rounded-md border" style={{ insetL: col * (cellW() + gap), insetT: row * (cellH() + gap), width: cellW(), height: cellH(), bgColor: focused() ? COLOR.accent : COLOR.panel, borderColor: focused() ? COLOR.accent : COLOR.line }}>
              <Text class="absolute left-0 text-sm font-bold text-center" style={{ width: cellW(), insetT: action().sub ? Math.max(2, (cellH() - 30) / 2) : (cellH() - 16) / 2, lineHeight: 16, textColor: focused() ? COLOR.accentInk : tone() }}>
                {action().label}
              </Text>
              <Show when={action().sub}>
                <Text class="absolute left-0 text-2xs leading-[12] text-center" style={{ width: cellW(), insetT: Math.max(2, (cellH() - 30) / 2) + 17, textColor: focused() ? COLOR.accentInk : COLOR.dim }}>
                  {action().sub}
                </Text>
              </Show>
            </View>
          );
        }}
      </Index>
    </View>
  );
}

/** Directions move through the grid, ok presses the focused action. */
export function useActionPad(actions: Accessor<readonly PadAction[]>, columns: number, selection: Selection, options: { onBack?: () => void; other?: (event: NavEvent) => boolean | void } = {}): void {
  useNav(event => {
    const count = actions().length;
    const at = selection.index();
    switch (event.key) {
      case "left":
        if (at % columns > 0) selection.set(at - 1);
        return true;
      case "right":
        if (at % columns < columns - 1 && at + 1 < count) selection.set(at + 1);
        return true;
      case "up":
        if (at - columns >= 0) selection.set(at - columns);
        return true;
      case "down":
        if (at + columns < count) selection.set(at + columns);
        return true;
      case "ok": {
        const action = actions()[at];
        if (action && !action.disabled) action.press();
        return true;
      }
      case "back":
        if (options.onBack) {
          options.onBack();
          return true;
        }
        break;
    }
    return options.other?.(event);
  });
}

// ---- detail --------------------------------------------------------------------------

export interface DetailProps extends Box {
  /** The one value the block is about. */
  value: () => string;
  unit?: string;
  label?: string;
  rows?: Accessor<readonly [string, string][]>;
  tone?: () => Tone;
}

/** One large value with its unit, and a few label/value rows under it. */
export function Detail(props: DetailProps): JSX.Element {
  const b = () => box(props, { x: GUTTER, y: 0, w: CONTENT_W, h: 136 });
  const valueWidth = () => Math.ceil(measure(props.value(), SLOT.xxlBold));
  return (
    <View class="absolute" style={{ insetL: b().x, insetT: b().y, width: b().w, height: b().h }}>
      <Show when={props.label}>
        <Text class="absolute left-0 top-0 text-2xs font-bold leading-[12] text-[#8e80ac]">{props.label}</Text>
      </Show>
      <Text class="absolute left-0 text-2xl font-bold leading-[26]" style={{ insetT: props.label ? 12 : 0, textColor: TONE_COLOR[props.tone?.() ?? "ink"] }}>
        {props.value()}
      </Text>
      <Show when={props.unit}>
        <Text class="absolute text-xs leading-[14] text-[#a99cc6]" style={{ insetL: valueWidth() + 4, insetT: (props.label ? 12 : 0) + 10 }}>
          {props.unit}
        </Text>
      </Show>
      <Show when={props.rows}>
        {rows => (
          <For each={rows()()}>
            {([label, value], i) => <KeyValue label={label} value={() => value} x={0} y={(props.label ? 12 : 0) + 30 + i() * (LINE.xs + 2)} w={b().w} />}
          </For>
        )}
      </Show>
    </View>
  );
}

export { RADIUS };
