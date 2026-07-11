import { joinRoom, selfId, type JsonValue, type Room } from "trystero";
import type { PatternId, ToneId } from "./backgrounds";
import type { Profile } from "./profile";

export { selfId };

export type ScenePayload = {
  elements: JsonValue[];
  files: Record<string, JsonValue>;
};

export type BackgroundPayload = { pattern: PatternId; tone: ToneId };

/** Cursor travels in Excalidraw *scene* coordinates so every peer can project it through their own scroll/zoom. */
export type CursorPayload = { x: number; y: number; tool?: "pointer" | "laser"; button?: "up" | "down" };

type WireProfile = { name: string; avatar: string; accent: string };

export type RoomCallbacks = {
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
  onProfile: (peerId: string, profile: Omit<Profile, "actorId">) => void;
  onCursor: (peerId: string, cursor: CursorPayload) => void;
  /** Incremental updates and full syncs both land here; merge is identical. */
  onScene: (peerId: string, scene: ScenePayload) => void;
  onBackground: (peerId: string, background: BackgroundPayload) => void;
};

export const MAX_PEERS = 7; // 8 people per room; a full WebRTC mesh stays comfortable at this size
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const CURSOR_INTERVAL_MS = 20;

export class EzRoom {
  private readonly room: Room;
  private readonly update;
  private readonly sync;
  private readonly cursor;
  private readonly hello;
  private readonly bg;
  private lastCursorAt = 0;
  private closed = false;

  constructor(
    readonly code: string,
    profile: Profile,
    private readonly callbacks: RoomCallbacks,
    getScene: () => ScenePayload | null,
    getBackground: () => BackgroundPayload,
  ) {
    // ponytail: nostr relays sign peers in; the room code doubles as an E2E password
    // so relays only ever see ciphertext. TURN-less — direct P2P or nothing.
    this.room = joinRoom(
      { appId: "online.vyasdevgna.ezboard", password: `ez:${code}`, relayConfig: { redundancy: 4 } },
      code,
    );
    this.update = this.room.makeAction<ScenePayload>("up");
    this.sync = this.room.makeAction<ScenePayload>("sync");
    this.cursor = this.room.makeAction<CursorPayload>("cur");
    this.hello = this.room.makeAction<WireProfile>("hi");
    this.bg = this.room.makeAction<BackgroundPayload>("bg");

    this.room.onPeerJoin = (peerId) => {
      if (this.closed || this.peerCount > MAX_PEERS) return;
      this.callbacks.onPeerJoin(peerId);
      // Every existing peer greets the newcomer with identity + full board state;
      // version-merge makes the redundancy harmless and the sync robust.
      void this.hello.send(toWire(profile), { target: peerId });
      void this.bg.send(getBackground(), { target: peerId });
      const scene = getScene();
      if (scene && fits(scene)) void this.sync.send(scene, { target: peerId });
    };
    this.room.onPeerLeave = (peerId) => this.callbacks.onPeerLeave(peerId);
    this.hello.onMessage = (wire, { peerId }) => this.callbacks.onProfile(peerId, fromWire(wire));
    this.cursor.onMessage = (cursor, { peerId }) => this.callbacks.onCursor(peerId, cursor);
    this.bg.onMessage = (background, { peerId }) => this.callbacks.onBackground(peerId, background);
    this.update.onMessage = (scene, { peerId }) => this.callbacks.onScene(peerId, scene);
    this.sync.onMessage = (scene, { peerId }) => this.callbacks.onScene(peerId, scene);
  }

  get peerCount(): number {
    return Object.keys(this.room.getPeers()).length;
  }

  sendUpdate(scene: ScenePayload): void {
    if (!this.closed && this.peerCount > 0 && fits(scene)) void this.update.send(scene);
  }

  sendCursor(cursor: CursorPayload): void {
    const now = performance.now();
    if (this.closed || now - this.lastCursorAt < CURSOR_INTERVAL_MS) return;
    this.lastCursorAt = now;
    void this.cursor.send(cursor);
  }

  sendProfile(profile: Profile): void {
    if (!this.closed) void this.hello.send(toWire(profile));
  }

  sendBackground(background: BackgroundPayload): void {
    if (!this.closed) void this.bg.send(background);
  }

  async leave(): Promise<void> {
    this.closed = true;
    await this.room.leave();
  }
}

function fits(payload: ScenePayload): boolean {
  return JSON.stringify(payload).length <= MAX_PAYLOAD_BYTES;
}

function toWire(profile: Profile): WireProfile {
  return { name: profile.name, avatar: profile.avatar ?? "", accent: profile.accent };
}

function fromWire(wire: WireProfile): Omit<Profile, "actorId"> {
  return { name: wire.name, avatar: wire.avatar || undefined, accent: wire.accent };
}
