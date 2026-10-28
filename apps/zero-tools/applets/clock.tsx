// Clock: the time in large digits, a countdown timer set with left and
// right, and a stopwatch with laps. The timer rings the speaker when it
// reaches zero.

import { createMemo, createSignal, onCleanup } from "solid-js";
import { Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { Chip, createSelection, cycle, Digits, List, Progress, toast, useHints, useNav, KEY_LABEL, CONTENT_W, GUTTER, digitsWidth } from "@pocketjs/framework/compact";
import { post } from "../device.ts";
import { createBlink, Tabs } from "../ui.tsx";

const MODES = ["clock", "timer", "stopwatch"] as const;
type Mode = (typeof MODES)[number];
const TABS = ["CLOCK", "TIMER", "STOPWATCH"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const two = (n: number) => String(n).padStart(2, "0");
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${two(Math.floor(s / 60))}:${two(s % 60)}`;
};
const lapText = (ms: number) => {
  const tenths = Math.floor(ms / 100);
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${two(s % 60)}.${tenths % 10}`;
};

export function ClockScene() {
  const [mode, setMode] = createSignal<Mode>("clock");
  const [now, setNow] = createSignal(Date.now());
  const blink = createBlink();
  let alive = true;
  const tick = () => {
    if (!alive) return;
    setNow(Date.now());
    after(0.1, tick);
  };
  tick();
  onCleanup(() => {
    alive = false;
  });

  // Timer: a length, and when running, the moment it ends.
  const [length, setLength] = createSignal(5 * 60 * 1000);
  const [endsAt, setEndsAt] = createSignal<number | null>(null);
  const [paused, setPaused] = createSignal<number | null>(null);
  const [rang, setRang] = createSignal(false);
  const remaining = createMemo(() => {
    const p = paused();
    if (p !== null) return p;
    const e = endsAt();
    return e === null ? length() : Math.max(0, e - now());
  });
  createMemo(() => {
    if (endsAt() !== null && paused() === null && remaining() === 0 && !rang()) {
      setRang(true);
      void post("/dev/audio/beep").catch(() => {});
      toast("Timer done", "accent");
    }
  });
  const timerRunning = () => endsAt() !== null && paused() === null && remaining() > 0;
  const timerToggle = () => {
    if (remaining() === 0) return;
    if (timerRunning()) setPaused(remaining());
    else if (paused() !== null) {
      setEndsAt(Date.now() + paused()!);
      setPaused(null);
    } else {
      setEndsAt(Date.now() + length());
      setRang(false);
    }
  };
  const timerReset = () => {
    setEndsAt(null);
    setPaused(null);
    setRang(false);
  };
  const adjust = (direction: -1 | 1, fine: boolean) => {
    if (endsAt() !== null) return;
    const step = fine ? 10_000 : 60_000;
    setLength(Math.max(10_000, Math.min(99 * 60_000, length() + direction * step)));
  };

  // Stopwatch.
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [elapsedBefore, setElapsedBefore] = createSignal(0);
  const [laps, setLaps] = createSignal<number[]>([]);
  const elapsed = () => elapsedBefore() + (startedAt() !== null ? now() - startedAt()! : 0);
  const lapSelection = createSelection(() => laps().length);
  const watchToggle = () => {
    if (startedAt() !== null) {
      setElapsedBefore(elapsed());
      setStartedAt(null);
    } else setStartedAt(Date.now());
  };
  const lapOrReset = () => {
    if (startedAt() !== null) setLaps(list => [elapsed(), ...list].slice(0, 20));
    else {
      setElapsedBefore(0);
      setLaps([]);
    }
  };

  useNav(event => {
    switch (event.key) {
      case "left":
        if (mode() === "timer" && endsAt() === null) adjust(-1, event.fine);
        else if (mode() !== "timer" || endsAt() === null) setMode(cycle(MODES, mode(), -1));
        return true;
      case "right":
        if (mode() === "timer" && endsAt() === null) adjust(1, event.fine);
        else if (mode() !== "timer" || endsAt() === null) setMode(cycle(MODES, mode(), 1));
        return true;
      case "up":
        if (mode() === "stopwatch") lapSelection.move(-1);
        else setMode(cycle(MODES, mode(), -1));
        return true;
      case "down":
        if (mode() === "stopwatch") lapSelection.move(1);
        else setMode(cycle(MODES, mode(), 1));
        return true;
      case "ok":
        if (mode() === "timer") timerToggle();
        else if (mode() === "stopwatch") watchToggle();
        return true;
      case "action":
        if (mode() === "timer") timerReset();
        else if (mode() === "stopwatch") lapOrReset();
        return true;
    }
    return;
  });
  useHints(() => {
    switch (mode()) {
      case "clock":
        return `${KEY_LABEL.arrows} mode   ${KEY_LABEL.back} back`;
      case "timer":
        return endsAt() === null
          ? `${KEY_LABEL.leftright} minutes (${KEY_LABEL.fine}: 10 s)   ${KEY_LABEL.ok} start   ${KEY_LABEL.updown} mode`
          : `${KEY_LABEL.ok} ${timerRunning() ? "pause" : remaining() === 0 ? "done" : "resume"}   ${KEY_LABEL.action} reset   ${KEY_LABEL.updown} mode`;
      case "stopwatch":
        return `${KEY_LABEL.ok} ${startedAt() !== null ? "stop" : "start"}   ${KEY_LABEL.action} ${startedAt() !== null ? "lap" : "reset"}   ${KEY_LABEL.leftright} mode`;
    }
  });

  const date = () => new Date(now());
  const hhmm = () => `${two(date().getHours())}:${two(date().getMinutes())}`;
  const seconds = () => two(date().getSeconds());
  const dateLine = () => `${DAYS[date().getDay()]} ${date().getDate()} ${MONTHS[date().getMonth()]} ${date().getFullYear()}`;
  const timerState = () => (remaining() === 0 && endsAt() !== null ? "DONE" : timerRunning() ? "RUNNING" : paused() !== null ? "PAUSED" : "SET");
  const timerTone = () => (remaining() === 0 && endsAt() !== null ? (blink() ? "warn" : "dim") : timerRunning() ? "ok" : "dim");

  return (
    <View class="absolute left-0 top-0 w-[320] h-[136]">
      <Tabs items={TABS} active={() => MODES.indexOf(mode())} />
      <Show when={mode() === "clock"}>
        <Digits value={hhmm} size="huge" x={Math.round((320 - digitsWidth("00:00", "huge") - 36) / 2)} y={28} />
        <Digits value={seconds} size="xl" x={Math.round((320 - digitsWidth("00:00", "huge") - 36) / 2) + digitsWidth("00:00", "huge") + 6} y={58} tone={() => "dim"} />
        <Text class="absolute left-0 text-sm leading-[16] text-center text-[#cbbde2]" style={{ width: 320, insetT: 96 }}>
          {dateLine()}
        </Text>
        <Text class="absolute left-0 text-2xs leading-[12] text-center text-[#8e80ac]" style={{ width: 320, insetT: 116 }}>
          The Zero's own clock (RX8130 RTC, set by the system)
        </Text>
      </Show>
      <Show when={mode() === "timer"}>
        <Digits value={() => mmss(remaining())} size="huge" x={Math.round((320 - digitsWidth("00:00", "huge")) / 2)} y={22} tone={() => (remaining() === 0 && endsAt() !== null ? (blink() ? "warn" : "ink") : "ink")} />
        <Chip text={timerState} tone={timerTone} x={262} y={3} />
        <Progress value={() => (length() > 0 ? remaining() / length() : 0)} x={GUTTER} y={88} w={CONTENT_W} h={6} tone={timerRunning() ? "ok" : "accent"} />
        <Text class="absolute left-0 text-2xs leading-[12] text-center text-[#8e80ac]" style={{ width: 320, insetT: 104 }}>
          {endsAt() === null ? `Set to ${mmss(length())}. Rings the speaker at zero.` : `Set for ${mmss(length())}`}
        </Text>
      </Show>
      <Show when={mode() === "stopwatch"}>
        <Digits value={() => lapText(elapsed())} size="big" x={GUTTER} y={20} w={CONTENT_W} align="center" tone={() => (startedAt() !== null ? "ink" : "dim")} />
        <Chip text={() => (startedAt() !== null ? "RUNNING" : elapsed() > 0 ? "STOPPED" : "READY")} tone={() => (startedAt() !== null ? "ok" : "dim")} x={244} y={3} />
        <List items={laps} selection={lapSelection} label={lap => `Lap ${laps().length - laps().indexOf(lap)}`} value={lap => lapText(lap)} x={GUTTER} y={62} w={CONTENT_W} h={74} empty="Tab marks a lap while running" />
      </Show>
    </View>
  );
}
