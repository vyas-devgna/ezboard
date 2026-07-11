import { joinRoom, type JsonValue, type Room } from "trystero";
import type { Profile } from "./profile";

export type Cursor = Profile & { x: number; y: number; updatedAt: number };
export type ScenePacket = {
  elements: JsonValue[];
  files: Record<string, JsonValue>;
  appState: { viewBackgroundColor: string; gridSize: number };
};

type WireProfile = {
  actorId: string;
  name: string;
  avatar: string;
  accent: string;
};

type WireCursor = WireProfile & { x: number; y: number; updatedAt: number };

type RoomCallbacks = {
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
  onProfile: (peerId: string, profile: Profile) => void;
  onCursor: (peerId: string, cursor: Cursor) => void;
  onScene: (peerId: string, scene: ScenePacket) => void;
  onStream: (peerId: string, stream: MediaStream) => void;
};

const MAX_PEERS = 3;
const MAX_SCENE_BYTES = 4 * 1024 * 1024;

export class EzRoom {
  private readonly room: Room;
  private readonly scene;
  private readonly profileAction;
  private readonly cursorAction;
  private lastSceneAt = 0;

  constructor(
    readonly code: string,
    private readonly profile: Profile,
    private readonly callbacks: RoomCallbacks,
    private readonly getScene: () => ScenePacket | null,
  ) {
    this.room = joinRoom({ appId: "online.vyasdevgna.ezboard" }, code);
    this.scene = this.room.makeAction<ScenePacket>("scene-v1");
    this.profileAction = this.room.makeAction<WireProfile>("profile-v1");
    this.cursorAction = this.room.makeAction<WireCursor>("cursor-v1");
    this.room.onPeerJoin = (peerId) => {
      if (Object.keys(this.room.getPeers()).length > MAX_PEERS) return;
      this.callbacks.onPeerJoin(peerId);
      void this.profileAction.send(toWireProfile(this.profile), { target: peerId });
      const scene = this.getScene();
      if (scene) void this.scene.send(scene, { target: peerId });
    };
    this.room.onPeerLeave = this.callbacks.onPeerLeave;
    this.room.onPeerStream = (stream, peerId) => this.callbacks.onStream(peerId, stream);
    this.profileAction.onMessage = (profile, { peerId }) => this.callbacks.onProfile(peerId, fromWireProfile(profile));
    this.cursorAction.onMessage = (cursor, { peerId }) => this.callbacks.onCursor(peerId, { ...fromWireProfile(cursor), x: cursor.x, y: cursor.y, updatedAt: cursor.updatedAt });
    this.scene.onMessage = (scene, { peerId }) => {
      if (JSON.stringify(scene).length <= MAX_SCENE_BYTES) this.callbacks.onScene(peerId, scene);
    };
  }

  get peerCount(): number {
    return Object.keys(this.room.getPeers()).length;
  }

  sendScene(scene: ScenePacket): void {
    const now = performance.now();
    if (now - this.lastSceneAt < 120 || JSON.stringify(scene).length > MAX_SCENE_BYTES) return;
    this.lastSceneAt = now;
    void this.scene.send(scene);
  }

  sendCursor(cursor: Cursor): void {
    void this.cursorAction.send({ ...toWireProfile(cursor), x: cursor.x, y: cursor.y, updatedAt: cursor.updatedAt });
  }

  addStream(stream: MediaStream): void {
    void Promise.all(this.room.addStream(stream));
  }

  async leave(): Promise<void> {
    await this.room.leave();
  }
}

function toWireProfile(profile: Profile): WireProfile {
  return { actorId: profile.actorId, name: profile.name, avatar: profile.avatar ?? "", accent: profile.accent };
}

function fromWireProfile(profile: WireProfile): Profile {
  return { actorId: profile.actorId, name: profile.name, avatar: profile.avatar || undefined, accent: profile.accent };
}
