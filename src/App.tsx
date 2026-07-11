import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportBoard } from "./lib/export";
import { ACCENTS, getProfile, readAvatar, sanitizeName, saveProfile, type Profile } from "./lib/profile";
import { EzRoom } from "./lib/room";
import type { Cursor, ScenePacket } from "./lib/room";
import { generateRoomCode, normalizeRoomCode } from "./lib/room-code";
import { mergeElements } from "./lib/scene";

const BOARD_KEY = "ezboard.board.v1";
const MAX_PARTICIPANTS = 4;

type StoredBoard = {
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  appState: { viewBackgroundColor: string; gridSize: AppState["gridSize"] };
};

type Participant = Profile & { id: string };

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const roomRef = useRef<EzRoom | null>(null);
  const sceneRef = useRef<ScenePacket | null>(null);
  const applyingRemote = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const cursorAt = useRef(0);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const [profile, setProfile] = useState<Profile>(getProfile);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomOpen, setRoomOpen] = useState(() => Boolean(normalizeRoomCode(location.hash.match(/^#\/room\/([A-Z0-9]{5})$/i)?.[1] ?? "")));
  const [profileOpen, setProfileOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [message, setMessage] = useState("Local board — changes stay in this browser.");

  const notify = useCallback((next: string) => {
    setMessage(next);
  }, []);

  const snapshot = useCallback((): ScenePacket | null => sceneRef.current, []);

  const applyRemoteScene = useCallback((_: string, packet: ScenePacket) => {
    const api = apiRef.current;
    if (!api || !Array.isArray(packet.elements)) return;
    const remoteElements = packet.elements as unknown as ExcalidrawElement[];
    const merged = mergeElements(api.getSceneElementsIncludingDeleted(), remoteElements);
    applyingRemote.current = true;
    api.addFiles(Object.values(packet.files) as BinaryFiles[string][]);
    api.updateScene({ elements: merged, appState: packet.appState });
    window.setTimeout(() => { applyingRemote.current = false; }, 0);
  }, []);

  const connect = useCallback(async (requestedCode: string) => {
    const code = normalizeRoomCode(requestedCode);
    if (!code) {
      notify("Use a five-character code without I, L, O, 0, or 1.");
      return false;
    }
    if (roomRef.current) await roomRef.current.leave();
    roomRef.current = new EzRoom(code, profile, {
      onPeerJoin: (id) => {
        setParticipants((current) => current.some((person) => person.id === id) || current.length >= MAX_PARTICIPANTS - 1
          ? current
          : [...current, { id, actorId: id, name: "Joining…", accent: "#9292aa" }]);
        notify("A collaborator connected.");
      },
      onPeerLeave: (id) => {
        setParticipants((current) => current.filter((person) => person.id !== id));
        setCursors((current) => { const next = { ...current }; delete next[id]; return next; });
        audioRefs.current.get(id)?.remove();
        audioRefs.current.delete(id);
      },
      onProfile: (id, remoteProfile) => {
        setParticipants((current) => {
          const existing = current.find((person) => person.id === id);
          return existing
            ? current.map((person) => person.id === id ? { ...remoteProfile, id } : person)
            : current.length >= MAX_PARTICIPANTS - 1 ? current : [...current, { ...remoteProfile, id }];
        });
      },
      onCursor: (id, cursor) => setCursors((current) => ({ ...current, [id]: cursor })),
      onScene: applyRemoteScene,
      onStream: (id, stream) => {
        audioRefs.current.get(id)?.remove();
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = stream;
        audioRefs.current.set(id, audio);
        void audio.play().catch(() => notify("Click Voice to allow remote audio."));
      },
    }, snapshot);
    setRoomCode(code);
    setParticipants([]);
    setRoomOpen(false);
    window.location.hash = `/room/${code}`;
    notify(`Room ${code} is ready. Share the link or code.`);
    return true;
  }, [applyRemoteScene, notify, profile, snapshot]);

  const leaveRoom = useCallback(async () => {
    await roomRef.current?.leave();
    roomRef.current = null;
    setRoomCode(null);
    setParticipants([]);
    setCursors({});
    window.location.hash = "";
    notify("Left the room. Your local board remains here.");
  }, [notify]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      notify("This browser cannot record a tab. Try current Chrome, Edge, or Firefox.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? { mimeType: "video/webm;codecs=vp9,opus" }
        : undefined);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setRecordingBlob(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      };
      recorder.start(1_000);
      recorderRef.current = recorder;
      setRecording(true);
      notify("Recording. Choose this tab and share tab audio in the browser prompt.");
    } catch {
      notify("Recording was not started.");
    }
  }, [notify]);

  const stopRecording = useCallback(() => recorderRef.current?.state === "recording" && recorderRef.current.stop(), []);

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) { notify("Join a room before starting voice."); return; }
    if (micRef.current) {
      const next = !micOn;
      micRef.current.getAudioTracks().forEach((track) => { track.enabled = next; });
      setMicOn(next);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micRef.current = stream;
      roomRef.current.addStream(stream);
      setMicOn(true);
      notify("Voice is on. Your microphone goes directly to room peers.");
    } catch {
      notify("Microphone permission was denied. Drawing still works.");
    }
  }, [micOn, notify]);

  const copyInvite = useCallback(async () => {
    if (!roomCode) return;
    const link = `${window.location.origin}${window.location.pathname}#/room/${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      notify("Invite link copied.");
    } catch {
      notify(`Copy this room code: ${roomCode}`);
    }
  }, [notify, roomCode]);

  const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    const board: StoredBoard = {
      elements: [...elements],
      files,
      appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize },
    };
    const packet: ScenePacket = {
      elements: board.elements as unknown as ScenePacket["elements"],
      files: board.files as unknown as ScenePacket["files"],
      appState: { viewBackgroundColor: board.appState.viewBackgroundColor, gridSize: board.appState.gridSize ?? 0 },
    };
    sceneRef.current = packet;
    if (!applyingRemote.current) roomRef.current?.sendScene(packet);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(BOARD_KEY, JSON.stringify(board)); }
      catch { notify("Local storage is full. Export the board before adding more media."); }
    }, 500);
  }, [notify]);

  const loadBoard = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    try {
      const stored = JSON.parse(localStorage.getItem(BOARD_KEY) ?? "null") as StoredBoard | null;
      if (stored?.elements) {
        api.addFiles(Object.values(stored.files ?? {}));
        api.updateScene({ elements: stored.elements, appState: stored.appState });
      }
    } catch {
      notify("Could not restore the previous board.");
    }
  }, [notify]);

  const importBoard = useCallback(async (file: File) => {
    if (!file.name.endsWith(".excalidraw") && file.type !== "application/json") {
      notify("Drop images straight onto the canvas; import .excalidraw files here.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as Partial<StoredBoard>;
      if (!Array.isArray(parsed.elements)) throw new Error();
      apiRef.current?.addFiles(Object.values(parsed.files ?? {}));
      apiRef.current?.updateScene({ elements: parsed.elements, appState: parsed.appState });
      notify("Board imported.");
    } catch {
      notify("That file is not a valid ezboard scene.");
    }
  }, [notify]);

  useEffect(() => {
    const audioElements = audioRefs.current;
    return () => {
      void roomRef.current?.leave();
      micRef.current?.getTracks().forEach((track) => track.stop());
      audioElements.forEach((audio) => audio.remove());
    };
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const room = roomRef.current;
      if (!room || performance.now() - cursorAt.current < 33) return;
      cursorAt.current = performance.now();
      room.sendCursor({ ...profile, x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight, updatedAt: Date.now() });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [profile]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setProfileOpen(true)} aria-label="Edit local profile">
          <img src="/brand/ezboard-mark.png" alt="" />
          <span>ezboard</span><small>private canvas</small>
        </button>
        <div className={`room-pill ${roomCode ? "is-live" : ""}`}>
          <i />{roomCode ? `ROOM ${roomCode}` : "LOCAL MODE"}
          {roomCode && <button onClick={copyInvite}>Copy invite</button>}
        </div>
        <div className="top-actions">
          <div className="avatars" aria-label={`${participants.length + 1} participants`}>
            <span className="avatar self" style={{ backgroundColor: profile.accent }}>{profile.avatar ? <img src={profile.avatar} alt="" /> : initials(profile.name)}</span>
            {participants.slice(0, 3).map((person) => <span className="avatar" key={person.id} style={{ backgroundColor: person.accent }}>{person.avatar ? <img src={person.avatar} alt="" /> : initials(person.name)}</span>)}
            {participants.length > 3 && <span className="avatar more">+{participants.length - 3}</span>}
          </div>
          <button className={`icon-button ${micOn ? "active" : ""}`} onClick={toggleMic} title="Voice">{micOn ? "Voice on" : "Voice"}</button>
          <button className={`icon-button ${recording ? "recording" : ""}`} onClick={recording ? stopRecording : startRecording} title="Record session">{recording ? "Stop" : "Record"}</button>
          <button className="primary" onClick={() => roomCode ? copyInvite() : setRoomOpen(true)}>{roomCode ? "Share" : "Collaborate"}</button>
        </div>
      </header>

      <section className="canvas-wrap">
        <Excalidraw
          excalidrawAPI={loadBoard}
          onChange={onChange}
          initialData={{ appState: { viewBackgroundColor: "#f7f7fb" } }}
          UIOptions={{ canvasActions: { loadScene: true, saveToActiveFile: false, export: false } }}
          theme="light"
        />
        <div className="canvas-hint">Drag images in · Select multiple items to group · Press ? for shortcuts</div>
        <label className="import-button" title="Import .excalidraw"><input type="file" accept=".excalidraw,application/json" onChange={(event) => event.target.files?.[0] && void importBoard(event.target.files[0])} />Import</label>
        <button className="export-button" onClick={() => setExportOpen((open) => !open)}>Export</button>
        {exportOpen && <div className="export-menu">
          {(["png", "svg", "pdf", "json"] as const).map((kind) => <button key={kind} onClick={() => {
            const api = apiRef.current;
            if (api) void exportBoard(kind, { elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles() });
            setExportOpen(false);
          }}>{kind === "json" ? "Editable .excalidraw" : kind.toUpperCase()}</button>)}
        </div>}
        {Object.entries(cursors).map(([id, cursor]) => <div className="remote-cursor" key={id} style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, color: cursor.accent }}><span>⌁</span><b>{cursor.name}</b></div>)}
      </section>

      <div className="status-bar" role="status"><span>{message}</span>{roomCode && <button onClick={leaveRoom}>Leave room</button>}</div>

      {roomOpen && <RoomDialog
        existingCode={location.hash.match(/^#\/room\/([A-Z0-9]{5})$/i)?.[1] ?? ""}
        onClose={() => setRoomOpen(false)}
        onConnect={(code, shouldRecord) => { void connect(code).then((joined) => { if (joined && shouldRecord) void startRecording(); }); }}
      />}
      {profileOpen && <ProfileDialog profile={profile} onClose={() => setProfileOpen(false)} onSave={(next) => { setProfile(saveProfile(next)); setProfileOpen(false); notify("Profile saved locally."); }} />}
      {recordingBlob && <RecordingDialog blob={recordingBlob} onDiscard={() => setRecordingBlob(null)} />}
    </main>
  );
}

function RoomDialog({ existingCode, onClose, onConnect }: { existingCode: string; onClose: () => void; onConnect: (code: string, record: boolean) => void }) {
  const [joinCode, setJoinCode] = useState(existingCode);
  const [record, setRecord] = useState(false);
  const create = () => onConnect(generateRoomCode(), record);
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="room-title">
    <button className="close" onClick={onClose} aria-label="Close">×</button>
    <p className="eyebrow">COLLABORATE</p><h1 id="room-title">Make space together.</h1>
    <p>Invite up to three people. Board data and voice go directly between browsers; public relays only help peers find each other.</p>
    <div className="room-options"><button className="primary wide" onClick={create}>Create a room <span>↗</span></button><label className="check"><input type="checkbox" checked={record} onChange={(event) => setRecord(event.target.checked)} /> Ask to record this session after joining</label></div>
    <div className="divider"><span>or join with a code</span></div>
    <form onSubmit={(event) => { event.preventDefault(); onConnect(joinCode, false); }}><input aria-label="Room code" maxLength={5} placeholder="ABCDE" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} /><button className="secondary wide">Join room</button></form>
    <small>Code-only rooms are convenient, not a secret. Share links only with people you trust.</small>
  </section></div>;
}

function ProfileDialog({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (profile: Profile) => void }) {
  const [name, setName] = useState(profile.name);
  const [accent, setAccent] = useState(profile.accent);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");
  return <div className="modal-backdrop" role="presentation"><section className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">LOCAL PROFILE</p><h1 id="profile-title">How you appear.</h1>
    <label>Name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /></label>
    <div className="profile-row"><span className="avatar large" style={{ backgroundColor: accent }}>{avatar ? <img src={avatar} alt="" /> : initials(name || "You")}</span><label className="avatar-upload">Add photo<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setAvatar(await readAvatar(file)); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not use that image."); } }} /></label>{avatar && <button className="text-button" onClick={() => setAvatar(undefined)}>Remove</button>}</div>
    <div className="swatches">{ACCENTS.map((color) => <button key={color} className={accent === color ? "selected" : ""} style={{ backgroundColor: color }} onClick={() => setAccent(color)} aria-label={`Choose ${color}`} />)}</div>
    {error && <p className="error">{error}</p>}<button className="primary wide" onClick={() => onSave({ ...profile, name: sanitizeName(name) || "You", accent, avatar })}>Save profile</button>
  </section></div>;
}

function RecordingDialog({ blob, onDiscard }: { blob: Blob; onDiscard: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="recording-title"><p className="eyebrow">RECORDING READY</p><h1 id="recording-title">Keep this session?</h1><p>The recording remains in this tab until you download or discard it.</p><div className="dialog-actions"><button className="secondary" onClick={onDiscard}>Discard</button><button className="primary" onClick={() => { download(blob, `ezboard-session-${Date.now()}.webm`); onDiscard(); }}>Download .webm</button></div></section></div>;
}
