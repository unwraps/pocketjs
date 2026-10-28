// The Zero's device API as the applets read it: `http://zero/dev/<topic>`
// answered by the program's own transport (programs/cardputer-zero/src/
// device/mod.rs). A topic is polled while its scene is active and read as a
// signal; a command is one POST. Nothing here runs inside a frame.

import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { after } from "@pocketjs/framework/clock";
import { fetch, type NetMethod } from "@pocketjs/framework/net";
import { toAscii } from "@pocketjs/framework/compact";

const ZERO = "http://zero";

export interface Capabilities {
  motion: boolean;
  magnet: boolean;
  battery: boolean;
  ir: { tx: boolean; rx: boolean };
  audio: { capture: boolean; play: boolean };
  camera: boolean;
  qr: boolean;
  wifi: boolean;
  ble: boolean;
  backlight: boolean;
  volume: boolean;
  mock: boolean;
}

export interface Motion {
  available: boolean;
  t: number;
  pitch: number;
  roll: number;
  heading: number | null;
  bubble: [number, number];
  accel: [number, number, number];
  gyro: [number, number, number];
  mag: [number, number, number] | null;
  magAvailable: boolean;
  shake: number;
  impactPeak: number;
  impacts: [number, number][];
  zeroed: boolean;
  calibrating: boolean;
  calibration: number | null;
}

export interface Battery {
  available: boolean;
  percent: number | null;
  voltage: number | null;
  current: number | null;
  power: number | null;
  status: string;
  temp: number | null;
}

export interface SystemInfo {
  hostname: string;
  uptime: number;
  load: [number, number, number];
  mem: { used: number; total: number };
  cpuTemp: number | null;
  ip: string | null;
  wifi: { ssid: string | null; rssi: number | null; link: number | null };
  backlight: { value: number; max: number } | null;
  volume: number | null;
  disk: { used: number; total: number } | null;
  clock: number;
}

export interface Audio {
  capturing: boolean;
  level: number;
  peak: number;
  spectrum: number[];
  wave: number[];
  pitch: { hz: number; note: string; cents: number } | null;
  blocks: number;
  recording: { name: string; seconds: number; started: number } | null;
  recordings: { name: string; seconds: number; bytes: number }[];
  playing: string | null;
  error: string | null;
  device: string;
}

export interface Ir {
  tx: boolean;
  rx: boolean;
  learning: boolean;
  sending: boolean;
  captured: { pulses: number[]; carrierHz: number; protocol: string; nec: { address: number; command: number; extended: boolean } | null; t: number } | null;
  lastSent: { t: number; ok: boolean; error: string } | null;
  signals: { id: number; name: string; protocol: string; count: number; nec: { address: number; command: number } | null }[];
}

export interface Network {
  ssid: string;
  bssid: string;
  signal: number;
  freq: number;
  chan: number;
  security: string;
  active: boolean;
}

export interface BleDevice {
  address: string;
  name: string | null;
  rssi: number | null;
}

export interface Radio {
  wifi: { scanning: boolean; t: number | null; error: string | null; networks: Network[] };
  ble: { scanning: boolean; t: number | null; error: string | null; devices: BleDevice[] };
}

export interface Camera {
  available: boolean;
  qrAvailable: boolean;
  busy: boolean;
  error: string | null;
  last: { name: string; t: number; at: number; width: number; height: number; qr: string | null; bytes: number } | null;
  photos: { name: string; bytes: number; modified: number }[];
  preview: string | null;
}

export async function request<T>(path: string, method: NetMethod = "GET", body?: unknown, timeoutMs = 8000): Promise<T> {
  const response = await fetch(`${ZERO}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    timeoutMs,
    maxBytes: 256 * 1024,
  });
  const text = await response.text();
  let value: { error?: string } = {};
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    if (response.ok) throw new Error("the device answered with something that is not JSON");
  }
  if (!response.ok) throw new Error(value.error ?? (text || `HTTP ${response.status}`));
  return value as T;
}

/** Raw bytes of a device route (the camera's preview). */
export async function requestBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(`${ZERO}${path}`, { method: "GET", timeoutMs: 8000, maxBytes: 256 * 1024 });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const post = (path: string, body?: unknown): Promise<unknown> => request(path, "POST", body);

export const message = (error: unknown): string => toAscii(error instanceof Error ? error.message : String(error));

export interface Topic<T> {
  data: Accessor<T | null>;
  error: Accessor<string | null>;
  /** Poll now, then keep the cadence. */
  refresh(): void;
}

/** `GET /dev/<path>` every `seconds` while `active` is true. A failed poll
 *  keeps the last data, records the error and tries again at twice the
 *  cadence. */
export function createTopic<T>(path: string, seconds: number, active: Accessor<boolean> = () => true): Topic<T> {
  const [data, setData] = createSignal<T | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let cancel: (() => void) | null = null;
  let running = false;
  let wanted = false;
  let generation = 0;
  const poll = async (): Promise<void> => {
    cancel?.();
    cancel = null;
    if (running) {
      wanted = true;
      return;
    }
    running = true;
    const mine = generation;
    let delay = seconds;
    try {
      const value = await request<T>(path);
      if (mine === generation) {
        setData(() => value);
        setError(null);
      }
    } catch (failure) {
      if (mine === generation) setError(message(failure));
      delay = seconds * 2;
    } finally {
      running = false;
    }
    if (mine !== generation) return;
    if (wanted) {
      wanted = false;
      return poll();
    }
    if (active()) cancel = after(delay, () => void poll());
  };
  createEffect(() => {
    if (active()) {
      generation++;
      void poll();
    } else {
      cancel?.();
      cancel = null;
      generation++;
    }
  });
  onCleanup(() => {
    cancel?.();
    generation++;
  });
  return { data, error, refresh: () => void poll() };
}

/** Read and write a small JSON blob the program keeps for the app. */
export const store = {
  get: <T>(key: string) => request<T | null>(`/dev/store/${key}`),
  set: (key: string, value: unknown) => request(`/dev/store/${key}`, "PUT", value),
};
