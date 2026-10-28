# Pocket Compact UI

`@pocketjs/framework/compact` is the kit for a small panel driven by keys:
the M5Stack CardputerZero's 320×170 screen and 46-key keyboard first, and
any buttons-only console after it. **A screen built with the kit shows one
task, keeps its state readable at a glance, and answers one vocabulary of
keys.** The reference application is Pocket Tools (`apps/zero-tools`), eight
tools on the Zero's own sensors, radios, microphone, camera and infrared
port; `programs/cardputer-zero` runs it.

The kit is Solid components and hooks over the ordinary PocketJS tree:
absolute boxes, baked glyphs, `net.http` to the program's device API. It
adds no operation and no capability. An application imports it with
`import { CompactApp, List, Gauge } from "@pocketjs/framework/compact"`.

## The frame

`CompactApp` draws three strips and holds a stack of scenes.

| Strip | Height | Content |
| --- | ---: | --- |
| Status bar | 18 px | The top scene's title at the left; the glance text at the right (battery and clock in Pocket Tools). |
| Body | 136 px | The top scene. Scenes under it stay mounted, hidden, with their state. |
| Hint bar | 16 px | The keys that act on this scene, as the scene names them with `useHints`. |

A scene is `{ title, hints, render }`. `useScenes().push(scene)` opens one
over the current; **Escape pops it, and at the root asks before leaving the
application** (`exit` on `CompactApp`); Escape held one second pops to the
root from any depth. A dialog (`confirm`) and a toast (`toast`) draw over
every scene. `useSceneActive()` is true while a scene is the top and no
dialog is open; a scene polls its device topic only then.

## Keys

The kit reads the keyboard's text events (`input.text`) in two passes. Raw
key handlers (`useKey`) come first: a `TextField` takes characters and
editing keys while it is active and returns true. What is left is read as
navigation (`useNav`):

| Key | Navigation | Without a keyboard |
| --- | --- | --- |
| Arrows; F, X, Z, C | up, down, left, right | d-pad |
| Enter | ok | ○ or START |
| Escape, Backspace | back (Escape held 1 s: home) | × (SELECT: home) |
| `/` | search | □ |
| Space | pause | START |
| Tab | action | △ |
| Shift + a direction | the same direction, `fine` | L or R + direction |

**F, X, Z and C stand for the arrows because the Zero's arrows sit on its Fn
layer and the vendor launcher reads these four keys the same way.** A held
direction repeats after 500 ms at 15 Hz; the kernel's own repeat events are
ignored. Handlers are scoped to the scene that registered them: the top
scene hears input, the ones under it do not, and an open dialog takes it
all. `KEY_LABEL` spells the keys for hints (`F/X`, `Enter`, `Esc`) and
spells the buttons on a console without a keyboard.

Left and right mean less and more, or previous and next, on every screen.
A list uses up and down; a value row uses left and right in place; a screen
with sections switches them with left and right and keeps up and down for
its list. A screen does not change what a key does while it stays up.

## Controls

| Control | Hook | Use |
| --- | --- | --- |
| `List` | `useListNav` | Find one item: label, optional detail line, right value, state dot. One focused row carries the wash and the accent bar; the list scrolls to keep it in view. 22 px a row, 30 with a detail line. |
| `ValueRows` | `useValueRows` | Settings: label and value, left and right adjust the focused row in place (`adjust(direction, fine)`), ok presses it. Chevrons show on an adjustable focused row. |
| `TextField` | (own `useKey`) | One line from the hardware keyboard: Enter submits, Escape cancels, Backspace deletes, Control+u clears. The caret blinks twice a second. |
| `ActionPad` | `useActionPad` | A grid of verbs: a remote's keys, a camera's shutter. The focused cell is filled with the accent. |
| `Detail` | | One large value with its unit and a few label/value rows. |
| `Progress`, `Panel`, `Chip`, `KeyValue` | | A bar, a box, a short state word in a tag (LIVE, HELD, REC), a dim label with an ink value. |

`createSelection(count)` is the clamped index the list hooks move;
`stepValue` and `cycle` are the arithmetic of value rows.

## Instruments

An instrument keeps the one physical metaphor that explains its value.

| Instrument | Shows | Metaphor kept |
| --- | --- | --- |
| `Digits` | A number in fixed-advance cells so changing digits do not jitter | Tabular numerals |
| `Gauge` | One large reading, its unit, a marker on a thin scale when the range is known | A panel meter |
| `Tuner` | A ruler sliding under a fixed centre pointer, the value above | A radio dial |
| `BubbleLevel` | Two rings, a crosshair, the bubble; cyan inside the inner ring | A spirit level |
| `TapeCompass` | Cardinal points and 15° ticks sliding past a lubber line, the bearing above | A tape compass |
| `SignalMeter` | Segments lit under the value, one held at the peak | A VU meter |
| `Bars` | Columns from the bottom or round the middle: spectrum, waveform, sparkline | A spectrum display |
| `RecorderStrip` | REC dot, elapsed time, level | A tape recorder |
| `StatusMatrix` | A grid of labels with a lamp or a short text each | An indicator panel |

Values arrive as accessors; an instrument redraws the bubble, the pointer or
the digits that moved and nothing else. **No instrument carries state by
colour alone: the chip beside it names the state in text.**

## Feedback

A key press shows within one frame: the focus moves, the chip changes, the
digits step. Work that takes longer shows its own state until it lands:
`SCANNING` with the last results still listed, `TAKING` with the shutter
veil, `SENDING` on the infrared pad. A result names what happened and no
more: `Sent` says the port transmitted, not that the television received.
A failure names its reason in the hint bar's tone of pink and keeps the
screen where it was. An irreversible action (delete a recording, a learned
key) confirms through a dialog whose destructive button is pink and not
chosen first.

## Tokens

`tokens.ts` holds every size and colour: the three strips, 6 px gutters,
22 px rows, 18 px buttons, the font slots (10 to 54 px), the plum
background `#171226`, the accent `#ffd23f` for focus and the value under
the hand, cyan `#3fd0e8` for a good state, pink `#ff7fb4` for a warning.
Text that arrives at run time folds to ASCII (`toAscii`) before it reaches
a `<Text>`, since the atlases hold the bundle's literals and printable
ASCII; `wrap` and `ellipsize` fit paragraphs and labels to measured widths.

## Pocket Tools

The eight tools, their mode and the device topic each reads
(`programs/cardputer-zero/src/device/mod.rs`, `http://zero/dev/<topic>`):

| Tool | Main screen | Topic |
| --- | --- | --- |
| Level | Bubble level, angle finder (ruler), tape compass; Enter holds, Tab zeroes or calibrates | `motion` |
| IR Remote | Pad of learned keys, Enter sends; Learn captures one key, shows its pulses and NEC decode, saves it under a name | `ir` |
| Audio | Level meter and waveform, 32-band spectrum, tuner (note and cents), recorder with its recordings | `audio` |
| Radio Explorer | Wi-Fi networks and Bluetooth devices nearby; one watched over repeated scans | `radio` |
| Camera | Take a picture, read a QR code from it; the picture shows as a texture | `camera` |
| Motion | Shake, acceleration per axis, a trace, the impact log | `motion` |
| Clock | Time in large digits, countdown timer, stopwatch with laps | (none) |
| System | Battery, network, memory, disk; brightness and volume adjusted in place | `system`, `battery` |

Build, shoot and install with `bun tools/cardputer-zero.ts build | shot |
tour | install root@<address>`; the program's README has the device facts.
