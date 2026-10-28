// The tools, in the order the Home list shows them. Each names what it needs
// of the device (device.ts Capabilities): a tool whose need is absent still
// opens and says so, since the panel must state what it cannot read.

import type { JSX } from "solid-js";
import type { Capabilities } from "../device.ts";
import { AudioScene } from "./audio.tsx";
import { CameraScene } from "./camera.tsx";
import { ClockScene } from "./clock.tsx";
import { IrScene } from "./ir.tsx";
import { LevelScene } from "./level.tsx";
import { MotionScene } from "./motion.tsx";
import { RadioScene } from "./radio.tsx";
import { SystemScene } from "./system.tsx";

export interface Applet {
  id: string;
  title: string;
  summary: string;
  /** The capabilities the tool reads; null when none is needed. */
  needs: ((caps: Capabilities) => boolean) | null;
  /** What is missing, for the Home row. */
  missing: string;
  render: () => JSX.Element;
}

export const APPLETS: readonly Applet[] = [
  { id: "level", title: "Level", summary: "Bubble level, angle finder and compass", needs: caps => caps.motion, missing: "no IMU", render: LevelScene },
  { id: "ir", title: "IR Remote", summary: "Learn a remote's keys and send them", needs: caps => caps.ir.tx || caps.ir.rx, missing: "no IR port", render: IrScene },
  { id: "audio", title: "Audio", summary: "Level, spectrum, tuner and recorder", needs: caps => caps.audio.capture, missing: "no microphone", render: AudioScene },
  { id: "radio", title: "Radio Explorer", summary: "Wi-Fi networks and Bluetooth devices nearby", needs: caps => caps.wifi || caps.ble, missing: "no scan tools", render: RadioScene },
  { id: "camera", title: "Camera", summary: "Take a picture, read a QR code", needs: caps => caps.camera, missing: "no camera", render: CameraScene },
  { id: "motion", title: "Motion", summary: "Shake, acceleration and impact log", needs: caps => caps.motion, missing: "no IMU", render: MotionScene },
  { id: "clock", title: "Clock", summary: "Time, countdown timer and stopwatch", needs: null, missing: "", render: ClockScene },
  { id: "system", title: "System", summary: "Battery, network, brightness and volume", needs: null, missing: "", render: SystemScene },
];
