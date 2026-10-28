# CardputerZero program

This program runs one package on the M5Stack CardputerZero: **the 320×170 RGB565 panel through fbdev (`/dev/fb0`), the keyboard as buttons and as text keys through evdev, `globalThis.net` over a loopback transport, and the device API behind it.** Its packages are Pocket Tools (`apps/zero-tools`, the eight tools of docs/COMPACT-UI.md) and Pocket Companion's own screen (`apps/companion-zero`, PR #615).

## Keys

The keyboard's keys reach the guest twice. As buttons: Enter is START, Esc, Backspace, Space and Z are CROSS, X is CIRCLE, C is TRIANGLE, Shift is SQUARE, and the arrows on the Fn layer are the d-pad. As text events (`input.text`): every key named as `KeyboardEvent.key` names it (`a`, `A`, `Enter`, `ArrowLeft`, `Control+z`, `Shift+ArrowRight`), with Shift and CapsLock applied to characters and the modifiers as events of their own. **The Zero's symbol layer arrives on key codes the US layout gives other keys (code 26 types `!`, code 74 types `[`); `keymap.rs` names them from the vendor's `/usr/share/keymaps/tca8418_keypad_m5stack_keymap.map` and falls back to the launcher's built-in table.**

## The transport

`src/net.rs` answers four kinds of URL. `http://zero/dev/…` is the device API below. `http://companion/…` goes to Pocket Companion's control API on `127.0.0.1`; **the port and the bearer token come from `control.json` in the companion's store, read for every request,** so a restarted companion is reached without restarting the screen and the guest never sees the token. `http://zero/quit` ends the program after the turn, and `http://zero/restart` runs `systemctl restart pocket-companion.service` (`--unit` names another unit). `http://127.0.0.1:<port>/…` and `http://localhost:<port>/…` go out as written; every other URL fails with `invalid_request`.

## The device API

`src/device/mod.rs` keeps one snapshot of the hardware and answers it as JSON. A sampler thread reads the IMU every 20 ms and the battery and system once a second; a GET is a copy of the latest snapshot. Long work (a scan, a capture, learning a signal) runs on its own thread and the topic carries `scanning`, `busy` or `learning` until it lands. `--mock` answers from synthesized readings on any machine.

| Route | Reads or does |
| --- | --- |
| `GET /dev/capabilities` | Which of the below the hardware offers. |
| `GET /dev/motion`; `POST /dev/motion/zero`, `/unzero`, `/calibrate {on}` | Pitch, roll, bubble, heading, acceleration, rotation rate, field, shake, impacts (BMI270 and BMM150 over IIO sysfs, `pose.rs`); the level's zero and the hard-iron calibration, kept in the store. |
| `GET /dev/battery` | Percent, voltage, current, power, status, temperature (`/sys/class/power_supply`). |
| `GET /dev/system`; `POST /dev/system/backlight {value}`, `/volume {value}` | Hostname, uptime, load, memory, disk, CPU temperature, address, Wi-Fi link (`/proc/net/wireless`, `nmcli`), backlight (`/sys/class/backlight`), mixer volume (`amixer`). |
| `GET /dev/audio`; `POST /dev/audio/capture {on}`, `/record {on}`, `/play {name}`, `/delete {name}`, `/beep` | Level and peak in dBFS, a 64-point waveform, 32 log-spaced bands, the pitch and its note (`dsp.rs`), from `arecord` at 16 kHz mono; recordings as WAV files; `aplay`. |
| `GET /dev/ir`; `POST /dev/ir/learn {on}`, `/send {id \| address,command \| pulses \| captured}`, `/save {name}`, `/rename`, `/delete` | The LIRC receiver and transmitter (`/dev/lirc*`, `ir.rs`): a capture as pulse and space durations with its NEC decode, replay, and saved keys. |
| `GET /dev/radio`; `POST /dev/radio/wifi/scan`, `/ble/scan` | `nmcli dev wifi list --rescan yes`; `bluetoothctl --timeout 6 scan on`. |
| `GET /dev/camera`; `POST /dev/camera/capture {qr}`; `GET /dev/camera/preview.rgba` | `rpicam-still` at 640×360 (GPIO 18 low powers the sensor, set through `pinctrl` when present), decoded to a 256×128 RGBA preview; `zbarimg` reads a QR code. |
| `GET`/`PUT /dev/store/<key>` | A JSON value the application keeps, at most 64 KiB, under `<store>/store/`. |

The store (`--store`, default `/opt/pocket/zero`) holds the calibration, the saved signals, `recordings/` and `photos/`.

## Running it

The profile (`profile.ts`) is compiled into the binary: `build.rs` copies the file named by `POCKETJS_PROFILE_RS`. Build and install from a Mac or Linux machine with `cargo-zigbuild` and zig:

```sh
bun tools/cardputer-zero.ts build                  # .pocket-build/cardputer-zero/
bun tools/cardputer-zero.ts install root@<address> # build, copy, register with APPLaunch
bun tools/cardputer-zero.ts tour                   # one shot of every tool from the mock device
```

`install` writes `/usr/bin/pocket-cardputer-zero`, `/usr/share/pocketjs/zero-tools.pocket`, the launcher entry `/usr/share/APPLaunch/applications/pocket-zero-tools.desktop` with its icon, and `/etc/sudoers.d/pocket-zero-tools`. **The launcher runs as `pi` and starts the program with `sudo -n`, because the sensors, the radios and the infrared port are root's.** The sudoers rule allows the `gpio` group that one command line, as the vendor's own root apps are allowed.

`--check` admits the package against the compiled profile without opening devices. `--shot DIR --script "…"` runs the program on any system with a scripted button and key source and an in-memory framebuffer of the panel's geometry; each `shot` event writes `DIR/<tick>.rgb565` (`src/shot.rs`), and `--mock` answers the device API beside it. A script word is `<tick>:<event>`: a button (`DOWN`, `ENTER`, `ESC`), a key (`key:f`, `key:Enter`, `key:Shift+ArrowRight`), typed text (`type:hello_world`) or `shot`.
