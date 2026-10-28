// Camera: one picture at a time. Enter takes it and the last picture shows
// as a texture; Tab takes one and reads a QR code from it. The shutter
// feedback is immediate; "saved" waits for the file.

import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Image, Text, View } from "@pocketjs/framework/components";
import { getOps } from "@pocketjs/framework/host";
import type { NodeMirror } from "@pocketjs/framework/renderer";
import { Chip, KeyValue, toast, useHints, useNav, useSceneActive, KEY_LABEL, GUTTER, wrap, SLOT, when } from "@pocketjs/framework/compact";
import { createTopic, message, post, requestBytes, type Camera } from "../device.ts";

const PREVIEW_W = 208;
const PREVIEW_H = 117;
const TEXTURE_W = 256;
const TEXTURE_H = 128;
const PSM_8888 = 3;

export function CameraScene() {
  const active = useSceneActive();
  const camera = createTopic<Camera>("/dev/camera", 0.5, active);
  const [shutter, setShutter] = createSignal(false);
  const [texture, setTexture] = createSignal(-1);
  let image: NodeMirror | undefined;
  let shownT = -1;

  const shoot = (qr: boolean) => {
    if (camera.data()?.busy) return;
    setShutter(true);
    void post("/dev/camera/capture", { qr })
      .then(() => camera.refresh())
      .catch(error => {
        toast(message(error), "warn");
        setShutter(false);
      });
  };
  createEffect(() => {
    const last = camera.data()?.last;
    if (camera.data() && !camera.data()!.busy) setShutter(false);
    if (!last || last.t === shownT) return;
    shownT = last.t;
    void requestBytes("/dev/camera/preview.rgba")
      .then(bytes => {
        if (bytes.length !== TEXTURE_W * TEXTURE_H * 4) throw new Error("the preview has the wrong size");
        const handle = getOps().uploadTexture(bytes, TEXTURE_W, TEXTURE_H, PSM_8888);
        if (handle < 0) throw new Error("no texture slot for the preview");
        const previous = texture();
        setTexture(handle);
        if (image) getOps().setImage(image.id, handle);
        if (previous >= 0) getOps().freeTexture?.(previous);
      })
      .catch(error => toast(message(error), "warn"));
  });
  onCleanup(() => {
    if (texture() >= 0) getOps().freeTexture?.(texture());
  });
  useNav(event => {
    switch (event.key) {
      case "ok":
        shoot(false);
        return true;
      case "action":
        shoot(true);
        return true;
    }
    return;
  });
  useHints(() => `${KEY_LABEL.ok} take a picture   ${KEY_LABEL.action} read a QR code   ${KEY_LABEL.back} back`);
  const state = () => {
    const c = camera.data();
    if (!c) return "WAITING";
    if (!c.available) return "NO CAMERA";
    if (c.busy || shutter()) return "TAKING";
    if (c.error) return "FAILED";
    return c.last ? "SAVED" : "READY";
  };
  const stateTone = () => {
    const c = camera.data();
    if (!c) return "dim";
    if (!c.available || c.error) return "warn";
    if (c.busy || shutter()) return "accent";
    return "ok";
  };
  const qrLines = () => {
    const c = camera.data();
    if (!c) return [];
    const text = c.last?.qr;
    if (text) return wrap(text, SLOT.tiny, 86).slice(0, 5);
    if (c.last && c.last.t === shownT && !c.qrAvailable) return ["QR needs zbarimg"];
    return [];
  };
  return (
    <View class="absolute left-0 top-0 w-[320] h-[136]">
      <View class="absolute rounded-sm bg-[#000000] border border-[#3a2d5c] overflow-hidden" style={{ insetL: GUTTER, insetT: 4, width: PREVIEW_W + 2, height: PREVIEW_H + 2 }}>
        <Show when={texture() >= 0} fallback={<Text class="absolute left-0 text-2xs leading-[12] text-center text-[#8e80ac]" style={{ width: PREVIEW_W, insetT: 52 }}>{camera.data()?.available === false ? "No camera on this Zero" : "No picture yet"}</Text>}>
          <Image nodeRef={(node: NodeMirror) => (image = node)} class="absolute" style={{ insetL: 1, insetT: 1, width: PREVIEW_W, height: PREVIEW_H }} />
        </Show>
        <Show when={shutter() || camera.data()?.busy}>
          <View class="absolute left-0 top-0 bg-[#fcf6ff60]" style={{ width: PREVIEW_W + 2, height: PREVIEW_H + 2 }} />
        </Show>
      </View>
      <Chip text={state} tone={stateTone} x={224} y={4} />
      <KeyValue label="photos" value={() => `${camera.data()?.photos.length ?? 0}`} x={224} y={22} w={90} />
      <KeyValue label="last" value={() => (camera.data()?.last ? when(camera.data()!.last!.at) : "--")} x={224} y={38} w={90} />
      <Show when={camera.data()?.error}>
        <Text class="absolute text-2xs leading-[12] text-[#ff7fb4]" style={{ insetL: 224, insetT: 56, width: 90 }}>
          {wrap(camera.data()!.error!, SLOT.tiny, 90).slice(0, 4).join("\n")}
        </Text>
      </Show>
      <Show when={qrLines().length > 0}>
        <Text class="absolute text-2xs font-bold leading-[12] text-[#8e80ac]" style={{ insetL: 224, insetT: 56 }}>
          QR
        </Text>
        <Text class="absolute text-2xs leading-[12] text-[#3fd0e8]" style={{ insetL: 224, insetT: 68, width: 90 }}>
          {qrLines().join("\n")}
        </Text>
      </Show>
    </View>
  );
}
