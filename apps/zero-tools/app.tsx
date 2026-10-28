// Pocket Tools on the CardputerZero: a Home list of eight tools, each a scene
// of the compact kit. Home is a vertical list with a one-line summary per
// tool; `/` opens a search field that filters it by what is typed. The
// status bar's right side glances at the battery and the clock; Escape at
// Home asks before handing the panel back to the launcher.

import { createMemo, createSignal, Show } from "solid-js";
import { View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { CompactApp, createSelection, KEY_LABEL, List, TextField, useHints, useListNav, useScenes, toast, GUTTER, CONTENT_W } from "@pocketjs/framework/compact";
import { APPLETS, type Applet } from "./applets/index.ts";
import { createTopic, post, type Battery, type Capabilities } from "./device.ts";

function HomeScene() {
  const scenes = useScenes();
  const caps = createTopic<Capabilities>("/dev/capabilities", 30);
  const [query, setQuery] = createSignal("");
  const [searching, setSearching] = createSignal(false);
  const items = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return APPLETS;
    return APPLETS.filter(applet => applet.title.toLowerCase().includes(q) || applet.summary.toLowerCase().includes(q) || applet.id.includes(q));
  });
  const selection = createSelection(() => items().length);
  const available = (applet: Applet) => {
    const c = caps.data();
    if (!applet.needs || !c) return true;
    return applet.needs(c);
  };
  const open = (index: number) => {
    const applet = items()[index];
    if (!applet) return;
    setSearching(false);
    scenes.push({ title: applet.title, render: applet.render });
  };
  useListNav(selection, {
    onOk: open,
    other: event => {
      if (event.key === "search") {
        setSearching(true);
        return true;
      }
      return;
    },
  });
  useHints(() => (searching() ? "Type to filter   Enter open   Esc close search" : `${KEY_LABEL.updown} move   ${KEY_LABEL.ok} open   ${KEY_LABEL.search} search   ${KEY_LABEL.back} quit`));
  const listY = () => (searching() ? 24 : 2);
  return (
    <View class="absolute left-0 top-0 w-[320] h-[136]">
      <Show when={searching()}>
        <TextField
          value={query}
          active={searching}
          placeholder="Search tools"
          x={GUTTER}
          y={2}
          w={CONTENT_W}
          onInput={value => {
            setQuery(value);
            selection.set(0);
          }}
          onSubmit={() => open(selection.index())}
          onCancel={() => {
            setSearching(false);
            setQuery("");
          }}
        />
      </Show>
      <List
        items={items}
        selection={selection}
        label={applet => applet.title}
        detail={applet => applet.summary}
        value={applet => (available(applet) ? "" : applet.missing)}
        dot={applet => (caps.data() ? (available(applet) ? "ok" : "warn") : null)}
        y={listY()}
        h={136 - listY()}
        empty="No tool matches"
      />
    </View>
  );
}

export default function ToolsApp() {
  const battery = createTopic<Battery>("/dev/battery", 10);
  const [now, setNow] = createSignal(new Date());
  // The clock in the status bar: once a second is enough for minutes.
  const tick = () => {
    setNow(new Date());
    after(1, tick);
  };
  tick();
  const glance = () => {
    const b = battery.data();
    const percent = b?.percent != null ? `${b.percent}%${b.status === "Charging" ? "+" : ""}` : "";
    const d = now();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return percent ? `${percent}   ${time}` : time;
  };
  return (
    <CompactApp
      root={{ title: "Pocket Tools", render: HomeScene }}
      glance={glance}
      exit={{
        title: "Leave Pocket Tools?",
        text: "The panel goes back to the launcher.",
        action: "Leave",
        run: () => {
          void post("/quit").catch(() => toast("Could not quit", "warn"));
        },
      }}
    />
  );
}
