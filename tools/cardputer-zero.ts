#!/usr/bin/env bun

// Pocket Tools on the M5Stack CardputerZero (programs/cardputer-zero,
// apps/zero-tools):
//
//   bun tools/cardputer-zero.ts build                    -> .pocket-build/cardputer-zero/
//   bun tools/cardputer-zero.ts install <host>           build, then install over SSH (root@<address>)
//   bun tools/cardputer-zero.ts shot --script "<tick>:<event> ..." [--out <dir>] [--no-mock]
//   bun tools/cardputer-zero.ts tour [--out <dir>]       one shot of every tool, from the mock device
//
// build    the profile, the package, the program for aarch64 Linux against
//          glibc 2.36 (the Zero's Debian 13 has 2.41; needs cargo-zigbuild and
//          zig), and the launcher icon.
// install  /usr/bin/pocket-cardputer-zero, /usr/share/pocketjs/zero-tools.pocket,
//          APPLaunch's entry and icon, and a sudoers rule that lets the gpio
//          group start the program as root (the sensors, radios and the
//          infrared port are root's). A Companion entry already installed
//          from an older build keeps its binary under
//          /usr/bin/pocket-cardputer-zero.companion, since its package was
//          admitted by an earlier profile. APPLaunch restarts to list the entry.
// shot     the program built for this computer, without the panel and the
//          keyboard, answering the device API from the mock: each `shot`
//          event of the script becomes <out>/<tick>.png, 2x. Events are
//          buttons (UP, ENTER, ESC), keys (key:f, key:Enter, key:Escape,
//          key:Shift+ArrowRight) and typed text (type:hello_world).

import { $ } from "bun";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { encodePNG } from "./png.ts";

const root = resolve(import.meta.dir, "..");
const out = join(root, ".pocket-build", "cardputer-zero");
const config = "programs/cardputer-zero/pocket.runtime-config.ts";
const profileRs = join(out, "profile", "pocket_profile.rs");
const pocket = join(out, "zero-tools.pocket");
const TARGET = "aarch64-unknown-linux-gnu";
const program = join(out, "cargo", TARGET, "release", "pocket-cardputer-zero");
const [WIDTH, HEIGHT] = [320, 170];
const PACKAGE_PATH = "/usr/share/pocketjs/zero-tools.pocket";
const BINARY = "/usr/bin/pocket-cardputer-zero";

const DESKTOP = `[Desktop Entry]
Type=Application
Name=Tools
Comment=Level, IR remote, audio, radio, camera, motion, clock, system
Exec=/usr/bin/sudo -n -- ${BINARY} --package ${PACKAGE_PATH}
Icon=share/images/pocket-zero-tools.png
Terminal=false
StartupNotify=false
`;
const SUDOERS = `%gpio ALL=(root) NOPASSWD: ${BINARY} --package ${PACKAGE_PATH}\n`;

const argv = process.argv.slice(2);
const option = (name: string) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const flag = (name: string) => argv.includes(name);

/** The launcher icon: a plum tile with a yellow bubble between two rings, the
 *  Level's face. ~100 px, as APPLaunch's own icons. */
function drawIcon(size: number): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  const c = size / 2;
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    const at = (y * size + x) * 4;
    const alpha = a / 255;
    rgba[at] = Math.round(rgba[at]! * (1 - alpha) + r * alpha);
    rgba[at + 1] = Math.round(rgba[at + 1]! * (1 - alpha) + g * alpha);
    rgba[at + 2] = Math.round(rgba[at + 2]! * (1 - alpha) + b * alpha);
    rgba[at + 3] = Math.max(rgba[at + 3]!, a);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > c) continue;
      put(x, y, 0x17, 0x12, 0x26);
      const ring = (radius: number, width: number) => Math.abs(d - radius) < width;
      if (ring(c * 0.86, 1.6) || ring(c * 0.46, 1.2)) put(x, y, 0x5a, 0x4d, 0x78);
      if (Math.abs(x + 0.5 - c) < 0.8 || Math.abs(y + 0.5 - c) < 0.8) put(x, y, 0x3a, 0x2d, 0x5c);
      const bubble = Math.hypot(x + 0.5 - c * 1.12, y + 0.5 - c * 0.9);
      if (bubble < c * 0.22) put(x, y, 0xff, 0xd2, 0x3f);
      if (bubble < c * 0.08) put(x, y, 0xfc, 0xf6, 0xff);
    }
  }
  return encodePNG(rgba, size, size);
}

async function compile(): Promise<void> {
  await $`bun tools/pocket.ts profile export --config ${config} --out ${join(out, "profile")}`.cwd(root);
  await $`bun tools/pocket.ts compile --manifest apps/zero-tools/pocket.json --project-root . --runtime-config ${config} --plan-dir ${join(out, "plan")} --outdir ${join(out, "dist")} --output ${pocket}`.cwd(root);
}

async function build(): Promise<void> {
  await compile();
  await $`cargo zigbuild --release -p pocket-cardputer-zero --target ${TARGET}.2.36 --target-dir ${join(out, "cargo")}`
    .cwd(root)
    .env({ ...process.env, POCKETJS_PROFILE_RS: profileRs });
  writeFileSync(join(out, "pocket-zero-tools.png"), drawIcon(100));
  writeFileSync(join(out, "pocket-zero-tools.desktop"), DESKTOP);
  writeFileSync(join(out, "pocket-zero-tools.sudoers"), SUDOERS);
  console.log(`cardputer-zero: ${program}\ncardputer-zero: ${pocket}`);
}

async function install(host: string): Promise<void> {
  await build();
  const images = "/usr/share/APPLaunch/share/images";
  const entries = "/usr/share/APPLaunch/applications";
  await $`ssh ${host} mkdir -p /usr/share/pocketjs /opt/pocket/zero`;
  await $`scp -q ${program} ${host}:${BINARY}.new`;
  await $`scp -q ${pocket} ${host}:${PACKAGE_PATH}`;
  await $`scp -q ${join(out, "pocket-zero-tools.png")} ${host}:${images}/pocket-zero-tools.png`;
  await $`scp -q ${join(out, "pocket-zero-tools.desktop")} ${host}:${entries}/pocket-zero-tools.desktop`;
  await $`scp -q ${join(out, "pocket-zero-tools.sudoers")} ${host}:/tmp/pocket-zero-tools.sudoers`;
  await $`ssh ${host} ${[
    "set -e",
    // A Companion screen installed by an earlier build was admitted by that
    // build's profile: it keeps that binary under another name.
    `if [ -f ${entries}/pocket-companion.desktop ] && [ -x ${BINARY} ] && ! cmp -s ${BINARY} ${BINARY}.new; then cp -p ${BINARY} ${BINARY}.companion; sed -i 's#-- ${BINARY}$#-- ${BINARY}.companion#' ${entries}/pocket-companion.desktop; if [ -f /etc/sudoers.d/pocket-companion ]; then sed -i 's#${BINARY} ""#${BINARY}.companion ""#' /etc/sudoers.d/pocket-companion; fi; fi`,
    `mv ${BINARY}.new ${BINARY}`,
    `chmod 755 ${BINARY}`,
    "visudo -cf /tmp/pocket-zero-tools.sudoers",
    "install -m 440 /tmp/pocket-zero-tools.sudoers /etc/sudoers.d/pocket-zero-tools",
    "rm /tmp/pocket-zero-tools.sudoers",
    `${BINARY} --check --package ${PACKAGE_PATH}`,
    "systemctl --user -M pi@ restart APPLaunch.service",
  ].join(" && ")}`;
}

async function hostProgram(): Promise<string> {
  await compile();
  await $`cargo build -p pocket-cardputer-zero --target-dir ${join(out, "host")}`.cwd(root).env({ ...process.env, POCKETJS_PROFILE_RS: profileRs });
  return join(out, "host", "debug", "pocket-cardputer-zero");
}

function convert(dir: string): void {
  for (const name of readdirSync(dir).filter(name => name.endsWith(".rgb565"))) {
    const raw = readFileSync(join(dir, name));
    const rgba = new Uint8Array(WIDTH * 2 * HEIGHT * 2 * 4);
    for (let y = 0; y < HEIGHT * 2; y++) {
      for (let x = 0; x < WIDTH * 2; x++) {
        const at = ((y >> 1) * WIDTH + (x >> 1)) * 2;
        const v = raw[at]! | (raw[at + 1]! << 8);
        const o = (y * WIDTH * 2 + x) * 4;
        rgba[o] = (((v >> 11) & 31) * 255) / 31;
        rgba[o + 1] = (((v >> 5) & 63) * 255) / 63;
        rgba[o + 2] = ((v & 31) * 255) / 31;
        rgba[o + 3] = 255;
      }
    }
    writeFileSync(join(dir, name.replace(/\.rgb565$/, ".png")), encodePNG(rgba, WIDTH * 2, HEIGHT * 2));
  }
}

async function shot(script: string, dir: string, mock: boolean): Promise<void> {
  const binary = await hostProgram();
  mkdirSync(dir, { recursive: true });
  const store = join(out, "mock-store");
  mkdirSync(store, { recursive: true });
  await $`${binary} --package ${pocket} --store ${store} ${mock ? ["--mock"] : []} --shot ${dir} --script ${script}`;
  convert(dir);
  console.log(`cardputer-zero: frames in ${dir}`);
}

/** Every tool's main screen after its device data arrived. */
const TOUR: [string, string][] = [
  ["home", "40:shot"],
  ["level", "20:key:Enter 70:shot 72:key:c 90:shot 92:key:c 120:shot"],
  ["ir", "20:key:x 24:key:Enter 60:shot 62:key:c 64:key:c 66:key:Enter 80:shot 150:shot"],
  ["audio", "20:key:x 22:key:x 24:key:Enter 80:shot 82:key:c 110:shot 112:key:c 140:shot 142:key:c 170:shot"],
  ["radio", "20:key:x 22:key:x 24:key:x 26:key:Enter 40:shot 130:shot 132:key:c 250:shot"],
  ["camera", "20:key:x 22:key:x 24:key:x 26:key:x 28:key:Enter 50:shot 52:key:Tab 60:shot 120:shot"],
  ["motion", "20:key:x 22:key:x 24:key:x 26:key:x 28:key:x 30:key:Enter 100:shot"],
  ["clock", "20:key:x 22:key:x 24:key:x 26:key:x 28:key:x 30:key:x 32:key:Enter 50:shot 52:key:c 70:shot 72:key:Enter 110:shot"],
  ["system", "20:key:x 22:key:x 24:key:x 26:key:x 28:key:x 30:key:x 32:key:x 34:key:Enter 80:shot 82:key:x 84:key:x 86:key:x 88:key:x 90:key:c 100:shot"],
  ["search", "20:key:/ 30:shot 32:type:rad 50:shot"],
  ["quit", "20:key:Escape 40:shot"],
];

async function tour(dir: string): Promise<void> {
  const binary = await hostProgram();
  const store = join(out, "mock-store");
  mkdirSync(store, { recursive: true });
  for (const [name, script] of TOUR) {
    const target = join(dir, name);
    mkdirSync(target, { recursive: true });
    await $`${binary} --package ${pocket} --store ${store} --mock --shot ${target} --script ${script}`;
    convert(target);
  }
  console.log(`cardputer-zero: tour in ${dir}`);
}

switch (argv[0]) {
  case "build":
    await build();
    break;
  case "install":
    if (!argv[1]) throw new Error("install needs an SSH host, e.g. root@192.168.8.159");
    await install(argv[1]);
    break;
  case "shot": {
    const script = option("--script");
    if (!script) throw new Error("shot needs --script");
    await shot(script, resolve(option("--out") ?? join(out, "shots")), !flag("--no-mock"));
    break;
  }
  case "tour":
    await tour(resolve(option("--out") ?? join(out, "tour")));
    break;
  default:
    console.error("usage: bun tools/cardputer-zero.ts build | install <host> | shot --script <events> [--out <dir>] [--no-mock] | tour [--out <dir>]");
    process.exit(2);
}
