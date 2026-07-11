import {
  Excalidraw,
  exportToCanvas,
  MainMenu,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { AppState, BinaryFileData, BinaryFiles, ExcalidrawImperativeAPI, Collaborator } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonValue } from "trystero";
import Library from "./Library";
import { patternStyle, toneColor, PATTERNS, TONES, type PatternId, type ToneId } from "./lib/backgrounds";
import { getMeta, loadScene, saveScene, updateMeta, type BoardMeta } from "./lib/boards";
import { exportBoard } from "./lib/export";
import { buildStencil, type Stencil } from "./lib/library";
import type { Profile } from "./lib/profile";
import { EzRoom, MAX_PEERS, type BackgroundPayload, type ScenePayload } from "./lib/room";
import { generateRoomCode, normalizeRoomCode } from "./lib/room-code";
import { diffElements, mergeElements, versionKey } from "./lib/scene";
import { Avatar, Icon, ProfileDialog, Toasts, useToasts } from "./ui";
import { LibraryBrowser } from "./LibraryBrowser";

const UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    toggleTheme: false,
    loadScene: false,
    saveToActiveFile: false,
    export: false as const,
    saveAsImage: false,
  },
} as const;

type Person = { name: string; accent: string; avatar?: string };
type CursorState = { x: number; y: number; t: number; tool?: "pointer" | "laser"; button?: "up" | "down" };
type View = { scrollX: number; scrollY: number; zoom: number };

export default function Board({ boardId, autoRoom, dark, onToggleTheme, profile, onProfileChange }: {
  boardId: string;
  autoRoom: string | null;
  dark: boolean;
  onToggleTheme: () => void;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const roomRef = useRef<EzRoom | null>(null);
  const applyingRemote = useRef(false);
  const sentVersions = useRef(new Map<string, string>());
  const knownFiles = useRef(new Set<string>());
  const flushTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);
  const viewRef = useRef<View>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const backgroundRef = useRef<BackgroundPayload>({ pattern: "dots", tone: "default" });
  const profileRef = useRef(profile);
  const darkRef = useRef(dark);
  const nameRef = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const joined = useRef(false);

  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initial, setInitial] = useState<{ elements: unknown[]; files: Record<string, unknown> } | null>(null);
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [name, setName] = useState("");
  const [background, setBackground] = useState<BackgroundPayload>(backgroundRef.current);
  const [view, setView] = useState<View>(viewRef.current);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [net, setNet] = useState<"ok" | "offline" | "reconnecting">("ok");
  const [participants, setParticipants] = useState<Record<string, Person>>({});
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const [panel, setPanel] = useState<"none" | "share" | "background" | "library">("none");
  const [libraryBrowserOpen, setLibraryBrowserOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toasts, push } = useToasts();
  const pushRef = useRef(push);
  pushRef.current = push;
  darkRef.current = dark;
  nameRef.current = name;

  /* ---------- persistence ---------- */

  const persistNow = useCallback(async () => {
    const current = apiRef.current;
    if (!current) return;
    try {
      await saveScene(boardId, {
        // Tombstones (isDeleted) are kept so deletions never resurrect after a rejoin.
        elements: current.getSceneElementsIncludingDeleted() as unknown as unknown[],
        files: current.getFiles() as unknown as Record<string, unknown>,
        background: backgroundRef.current,
      });
    } catch {
      pushRef.current("Storage is full — export the board to keep a safe copy.");
    }
  }, [boardId]);
  const persistNowRef = useRef(persistNow);
  persistNowRef.current = persistNow;

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void persistNowRef.current();
    }, 600);
  }, []);

  /* ---------- collaboration ---------- */

  const getScene = useCallback((): ScenePayload | null => {
    const current = apiRef.current;
    if (!current) return null;
    return {
      elements: current.getSceneElementsIncludingDeleted() as unknown as JsonValue[],
      files: current.getFiles() as unknown as Record<string, JsonValue>,
    };
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current !== null) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      const current = apiRef.current;
      const room = roomRef.current;
      if (!current || !room) return;
      const dirty = diffElements(current.getSceneElementsIncludingDeleted(), sentVersions.current);
      if (!dirty.length) return;
      const files = current.getFiles();
      const payloadFiles: Record<string, JsonValue> = {};
      for (const element of dirty) {
        if (element.type === "image" && element.fileId && !knownFiles.current.has(element.fileId) && files[element.fileId]) {
          payloadFiles[element.fileId] = files[element.fileId] as unknown as JsonValue;
        }
      }
      room.sendUpdate({ elements: dirty as unknown as JsonValue[], files: payloadFiles });
      for (const element of dirty) sentVersions.current.set(element.id, versionKey(element));
      for (const id of Object.keys(payloadFiles)) knownFiles.current.add(id);
    }, 80);
  }, []);

  const applyRemote = useCallback((_peerId: string, payload: ScenePayload) => {
    const current = apiRef.current;
    if (!current || !Array.isArray(payload.elements)) return;
    const incoming = payload.elements as unknown as ExcalidrawElement[];
    // Pre-mark incoming versions: newer-than-ours won't echo back; older-than-ours
    // leaves our copy "dirty" so the stale peer gets corrected on the next flush.
    for (const element of incoming) sentVersions.current.set(element.id, versionKey(element));
    const fileList = Object.values(payload.files ?? {}) as unknown as BinaryFileData[];
    for (const file of fileList) knownFiles.current.add(file.id);
    const merged = mergeElements(current.getSceneElementsIncludingDeleted(), incoming);
    applyingRemote.current = true;
    if (fileList.length) current.addFiles(fileList);
    current.updateScene({ elements: merged, commitToHistory: false });
    window.setTimeout(() => { applyingRemote.current = false; }, 0);
    scheduleSave();
    scheduleFlush();
  }, [scheduleFlush, scheduleSave]);

  const connect = useCallback((requested: string) => {
    const code = normalizeRoomCode(requested);
    if (!code) { pushRef.current("That room code is not valid."); return; }
    const previous = roomRef.current;
    roomRef.current = null;
    if (previous) void previous.leave();
    setParticipants({});
    setCursors({});
    setRoomCode(code);
    setNet("ok");
    roomRef.current = new EzRoom(code, profileRef.current, {
      onPeerJoin: (id) => setParticipants((people) =>
        people[id] || Object.keys(people).length >= MAX_PEERS ? people : { ...people, [id]: { name: "Joining…", accent: "#8b8b9e" } }),
      onPeerLeave: (id) => {
        setParticipants((people) => {
          const { [id]: gone, ...rest } = people;
          if (gone && gone.name !== "Joining…") pushRef.current(`${gone.name} left.`);
          return rest;
        });
        setCursors((current) => { const rest = { ...current }; delete rest[id]; return rest; });
      },
      onProfile: (id, remote) => setParticipants((people) => {
        if (!people[id] && Object.keys(people).length >= MAX_PEERS) return people;
        if (!people[id] || people[id].name === "Joining…") pushRef.current(`${remote.name} joined.`);
        return { ...people, [id]: remote };
      }),
      onCursor: (id, cursor) => setCursors((current) => ({ ...current, [id]: { ...cursor, t: Date.now() } })),
      onScene: applyRemote,
      onBackground: (_id, remoteBackground) => {
        backgroundRef.current = remoteBackground;
        setBackground(remoteBackground);
        scheduleSave();
      },
    }, getScene, () => backgroundRef.current);
    void updateMeta(boardId, { room: code });
    setMeta((current) => current ? { ...current, room: code } : current);
    history.replaceState(null, "", `#/room/${code}`);
  }, [applyRemote, boardId, getScene, scheduleSave]);
  const connectRef = useRef(connect);
  connectRef.current = connect;

  const leaveRoom = useCallback(() => {
    void roomRef.current?.leave();
    roomRef.current = null;
    setRoomCode(null);
    setParticipants({});
    setCursors({});
    setPanel("none");
    history.replaceState(null, "", `#/b/${boardId}`);
    pushRef.current("Left the session. The board stays on this device.");
  }, [boardId]);

  /* ---------- excalidraw handlers (stable identities) ---------- */

  const onApi = useCallback((instance: ExcalidrawImperativeAPI) => {
    apiRef.current = instance;
    setApi(instance);
    window.setTimeout(() => {
      if (instance.getSceneElements().length) instance.scrollToContent(undefined, { fitToContent: true });
    }, 0);
  }, []);

  const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
    const current = viewRef.current;
    if (current.scrollX !== appState.scrollX || current.scrollY !== appState.scrollY || current.zoom !== appState.zoom.value) {
      viewRef.current = { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value };
      setView(viewRef.current);
    }
    if (!elements.length && !Object.keys(appState.selectedElementIds).length && sentVersions.current.size === 0) return;
    scheduleSave();
    if (roomRef.current && !applyingRemote.current) scheduleFlush();
  }, [scheduleFlush, scheduleSave]);

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number; tool?: "pointer" | "laser" }; button: "up" | "down" }) => {
    roomRef.current?.sendCursor({ x: payload.pointer.x, y: payload.pointer.y, tool: payload.pointer.tool, button: payload.button });
  }, []);

  /* ---------- actions ---------- */

  const exit = useCallback(async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await persistNowRef.current();
    const current = apiRef.current;
    const elements = current?.getSceneElements() ?? [];
    if (current && elements.length) {
      try {
        const canvas = await exportToCanvas({
          elements,
          appState: { viewBackgroundColor: toneColor(backgroundRef.current.tone, false), exportBackground: true },
          files: current.getFiles(),
          maxWidthOrHeight: 520,
        });
        await updateMeta(boardId, { thumb: canvas.toDataURL("image/jpeg", 0.65) });
      } catch { /* thumbnail is decorative */ }
    } else {
      await updateMeta(boardId, { thumb: undefined });
    }
    void roomRef.current?.leave();
    roomRef.current = null;
    window.location.hash = "";
  }, [boardId]);
  const exitRef = useRef(exit);
  exitRef.current = exit;

  const doExport = useCallback(async (kind: "png" | "svg" | "pdf" | "json") => {
    const current = apiRef.current;
    if (!current) return;
    if (!current.getSceneElements().length) { pushRef.current("Nothing to export yet."); return; }
    try {
      await exportBoard(kind, {
        elements: current.getSceneElements(),
        appState: current.getAppState(),
        files: current.getFiles(),
      }, toneColor(backgroundRef.current.tone, darkRef.current), nameRef.current);
      pushRef.current(`Exported as ${kind === "json" ? ".excalidraw" : kind.toUpperCase()}.`);
    } catch {
      pushRef.current("Export failed — try again.");
    }
  }, []);
  const doExportRef = useRef(doExport);
  doExportRef.current = doExport;

  const importFile = useCallback(async (file: File) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(await file.text()) as { type?: string; libraryItems?: any[]; elements?: ExcalidrawElement[]; files?: Record<string, BinaryFileData> };
      const current = apiRef.current;
      if (!current) return;
      if (parsed.type === "excalidrawlib") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current.updateLibrary({ libraryItems: parsed.libraryItems as any, merge: true, openLibraryMenu: true });
        pushRef.current("Library imported successfully.");
        return;
      }
      if (!Array.isArray(parsed.elements)) throw new Error("bad file");
      current.addFiles(Object.values(parsed.files ?? {}));
      current.updateScene({
        elements: mergeElements(current.getSceneElementsIncludingDeleted(), parsed.elements),
        commitToHistory: true,
      });
      current.scrollToContent(undefined, { fitToContent: true });
      pushRef.current("Imported into this board.");
    } catch {
      pushRef.current("That file is not a valid .excalidraw scene or library.");
    }
  }, []);

  const insertStencil = useCallback((stencil: Stencil) => {
    const current = apiRef.current;
    if (!current) return;
    const appState = current.getAppState();
    const center = viewportCoordsToSceneCoords(
      { clientX: appState.offsetLeft + appState.width / 2, clientY: appState.offsetTop + appState.height / 2 },
      appState,
    );
    const created = buildStencil(stencil, center.x, center.y);
    current.updateScene({
      elements: [...current.getSceneElementsIncludingDeleted(), ...created],
      appState: { selectedElementIds: Object.fromEntries(created.map((element) => [element.id, true as const])) } as unknown as AppState,
      commitToHistory: true,
    });
    if (window.innerWidth < 760) setPanel("none");
  }, []);

  const setBoardBackground = useCallback((patch: Partial<BackgroundPayload>) => {
    const next = { ...backgroundRef.current, ...patch };
    backgroundRef.current = next;
    setBackground(next);
    roomRef.current?.sendBackground(next);
    scheduleSave();
  }, [scheduleSave]);

  const copyInvite = useCallback(async (codeOnly = false) => {
    if (!roomCode) return;
    const text = codeOnly ? roomCode : `${window.location.origin}${window.location.pathname}#/room/${roomCode}`;
    try {
      await navigator.clipboard.writeText(text);
      pushRef.current(codeOnly ? "Room code copied." : "Invite link copied.");
    } catch {
      pushRef.current(`Share this code: ${roomCode}`);
    }
  }, [roomCode]);

  const renameBoard = useCallback((value: string) => {
    const trimmed = value.trim().slice(0, 60);
    if (!trimmed || trimmed === meta?.name) { setName(meta?.name ?? ""); return; }
    setName(trimmed);
    void updateMeta(boardId, { name: trimmed });
    setMeta((current) => current ? { ...current, name: trimmed } : current);
  }, [boardId, meta?.name]);

  /* ---------- effects ---------- */

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadScene(boardId), getMeta(boardId)]).then(([scene, loadedMeta]) => {
      if (cancelled) return;
      if (!loadedMeta) { window.location.hash = ""; return; }
      setMeta(loadedMeta);
      setName(loadedMeta.name);
      backgroundRef.current = scene.background;
      setBackground(scene.background);
      setInitial({ elements: scene.elements, files: scene.files });
    });
    return () => { cancelled = true; };
  }, [boardId]);

  useEffect(() => {
    if (autoRoom && api && !joined.current) {
      joined.current = true;
      connectRef.current(autoRoom);
    }
  }, [autoRoom, api]);

  useEffect(() => {
    profileRef.current = profile;
    roomRef.current?.sendProfile(profile);
  }, [profile]);

  // Network drop → wait for the browser to come back, then rejoin the same room.
  useEffect(() => {
    if (!roomCode) return;
    const onOffline = () => setNet("offline");
    const onOnline = () => {
      setNet("reconnecting");
      window.setTimeout(() => {
        if (navigator.onLine) {
          connectRef.current(roomCode);
          pushRef.current("Back online — rejoined the session.");
        }
      }, 900);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [roomCode]);

  // Sweep cursors of peers that stopped moving (tab hidden, etc.).
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCursors((current) => {
        const now = Date.now();
        const alive = Object.entries(current).filter(([, cursor]) => now - cursor.t < 12_000);
        return alive.length === Object.keys(current).length ? current : Object.fromEntries(alive);
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onHide = () => { void persistNowRef.current(); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void roomRef.current?.leave();
      if (saveTimer.current) { window.clearTimeout(saveTimer.current); void persistNowRef.current(); }
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
    };
  }, []);

  // Sync cursors into Excalidraw's native collaborators API
  useEffect(() => {
    if (!api || !roomCode) return;
    const collabs = new Map<string, Collaborator>();
    for (const [id, cursor] of Object.entries(cursors)) {
      const person = participants[id];
      if (person) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pointer: any = { x: cursor.x, y: cursor.y };
        if (cursor.tool) pointer.tool = cursor.tool;
        collabs.set(id, {
          pointer,
          button: cursor.button,
          username: person.name,
          color: { background: person.accent, stroke: "#fff" },
        });
      }
    }
    api.updateScene({ collaborators: collabs });
  }, [api, cursors, participants, roomCode]);

  /* ---------- render ---------- */

  const initialData = useMemo(() => initial && {
    elements: initial.elements as ExcalidrawElement[],
    files: initial.files as BinaryFiles,
    appState: { viewBackgroundColor: "transparent" },
  }, [initial]);

  const excalidraw = useMemo(() => initialData && (
    <Excalidraw
      excalidrawAPI={onApi}
      initialData={initialData}
      onChange={onChange}
      onPointerUpdate={onPointerUpdate}
      UIOptions={UI_OPTIONS}
      theme={dark ? "dark" : "light"}
    >
      <MainMenu>
        <MainMenu.Item onSelect={() => void doExportRef.current("png")} icon={<Icon name="download" size={14} />}>Export PNG</MainMenu.Item>
        <MainMenu.Item onSelect={() => void doExportRef.current("svg")} icon={<Icon name="download" size={14} />}>Export SVG</MainMenu.Item>
        <MainMenu.Item onSelect={() => void doExportRef.current("pdf")} icon={<Icon name="download" size={14} />}>Export PDF</MainMenu.Item>
        <MainMenu.Item onSelect={() => void doExportRef.current("json")} icon={<Icon name="download" size={14} />}>Export .excalidraw</MainMenu.Item>
        <MainMenu.Item onSelect={() => fileInput.current?.click()} icon={<Icon name="upload" size={14} />}>Import .excalidraw</MainMenu.Item>
        <MainMenu.Item onSelect={() => setLibraryBrowserOpen(true)} icon={<Icon name="shapes" size={14} />}>Top Libraries</MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.Item onSelect={() => void exitRef.current()} icon={<Icon name="back" size={14} />}>All boards</MainMenu.Item>
      </MainMenu>
    </Excalidraw>
  ), [initialData, dark, onApi, onChange, onPointerUpdate]);

  const peerCount = Object.keys(participants).length;
  const statusLabel = !roomCode ? null
    : net === "offline" ? "Offline — changes saved here"
    : net === "reconnecting" ? "Reconnecting…"
    : peerCount === 0 ? `Room ${roomCode} — waiting for others`
    : `${peerCount + 1} drawing together`;

  return (
    <div className="board">
      <header className="board-head">
        <div className="head-left">
          <button className="icon-button" onClick={() => void exit()} title="All boards" aria-label="Back to boards"><Icon name="back" /></button>
          <input
            className="board-name" value={name} maxLength={60} aria-label="Board name" spellCheck={false}
            onChange={(event) => setName(event.target.value)}
            onBlur={(event) => renameBoard(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
        </div>

        {statusLabel && (
          <div className={`status-pill ${net !== "ok" ? "warn" : peerCount > 0 ? "live" : ""}`}>
            <i />{statusLabel}
          </div>
        )}

        <div className="head-right">
          {roomCode && (
            <div className="avatars" title={`${peerCount + 1} in the room`}>
              <Avatar name={profile.name} accent={profile.accent} avatar={profile.avatar} ring />
              {Object.entries(participants).slice(0, 4).map(([id, person]) => (
                <Avatar key={id} name={person.name} accent={person.accent} avatar={person.avatar} />
              ))}
              {peerCount > 4 && <span className="avatar more">+{peerCount - 4}</span>}
            </div>
          )}
          {meta?.room && !roomCode && (
            <button className="chip" onClick={() => connect(meta.room!)} title="Rejoin the last session on this board">
              <Icon name="users" size={13} /> Rejoin {meta.room}
            </button>
          )}
          <button className={`icon-button ${panel === "library" ? "active" : ""}`} title="Shape library"
            onClick={() => setPanel(panel === "library" ? "none" : "library")}><Icon name="shapes" /></button>
          <button className={`icon-button ${panel === "background" ? "active" : ""}`} title="Background"
            onClick={() => setPanel(panel === "background" ? "none" : "background")}><Icon name="grid" /></button>
          <button className="icon-button" onClick={onToggleTheme} title={dark ? "Light mode" : "Dark mode"}><Icon name={dark ? "sun" : "moon"} /></button>
          <button className="avatar-button" onClick={() => setProfileOpen(true)} title="Your presence">
            <Avatar name={profile.name} accent={profile.accent} avatar={profile.avatar} size={30} />
          </button>
          <button className={`primary share ${roomCode && peerCount > 0 ? "live" : ""}`} onClick={() => setPanel(panel === "share" ? "none" : "share")}>
            <Icon name="users" size={15} /><span>{roomCode ? "Session" : "Share"}</span>
          </button>
        </div>
      </header>

      <section className="canvas-wrap">
        <div className="pattern-layer" style={patternStyle(background.pattern, background.tone, dark, view)} />
        {excalidraw ?? <div className="board-loading"><span className="spin"><Icon name="spinner" size={24} /></span></div>}



        {panel === "library" && <Library onInsert={insertStencil} onClose={() => setPanel("none")} />}

        {panel === "background" && (
          <div className="popover bg-popover">
            <h3>Pattern</h3>
            <div className="pattern-row">
              {PATTERNS.map((pattern) => (
                <button key={pattern.id} className={background.pattern === pattern.id ? "selected" : ""}
                  onClick={() => setBoardBackground({ pattern: pattern.id as PatternId })} title={pattern.label}>
                  <span className={`pattern-swatch p-${pattern.id}`} />
                  <small>{pattern.label}</small>
                </button>
              ))}
            </div>
            <h3>Paper</h3>
            <div className="tone-row">
              {TONES.map((tone) => (
                <button key={tone.id} className={background.tone === tone.id ? "selected" : ""}
                  style={{ backgroundColor: dark ? tone.dark : tone.light }}
                  onClick={() => setBoardBackground({ tone: tone.id as ToneId })} aria-label={tone.label} title={tone.label} />
              ))}
            </div>
            {roomCode && <small className="hint">Background is shared with everyone in the room.</small>}
          </div>
        )}

        {panel === "share" && (
          <div className="popover share-popover">
            {!roomCode ? (
              <>
                <p className="eyebrow">DRAW TOGETHER</p>
                <h2>Start a live session</h2>
                <p className="muted">Up to {MAX_PEERS + 1} people connect browser-to-browser. The board never touches a server, and the room code encrypts the handshake.</p>
                <button className="primary wide" onClick={() => { connect(generateRoomCode()); }}>
                  <Icon name="users" size={15} /> Start session
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">LIVE SESSION</p>
                <div className="room-code" aria-label={`Room code ${roomCode}`}>
                  {roomCode.split("").map((character, index) => <span key={index}>{character}</span>)}
                </div>
                <div className="share-actions">
                  <button className="secondary" onClick={() => void copyInvite(false)}><Icon name="link" size={14} /> Copy link</button>
                  <button className="secondary" onClick={() => void copyInvite(true)}><Icon name="copy" size={14} /> Copy code</button>
                </div>
                <ul className="people">
                  <li><Avatar name={profile.name} accent={profile.accent} avatar={profile.avatar} size={26} /><span>{profile.name} (you)</span></li>
                  {Object.entries(participants).map(([id, person]) => (
                    <li key={id}><Avatar name={person.name} accent={person.accent} avatar={person.avatar} size={26} /><span>{person.name}</span></li>
                  ))}
                </ul>
                <button className="text-button danger" onClick={leaveRoom}><Icon name="leave" size={14} /> Leave session</button>
              </>
            )}
          </div>
        )}
      </section>

      <input ref={fileInput} type="file" accept=".excalidraw,.excalidrawlib,application/json" hidden
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />

      {libraryBrowserOpen && (
        <LibraryBrowser
          onClose={() => setLibraryBrowserOpen(false)}
          onInstall={async (lib) => {
            try {
              const res = await fetch(`https://libraries.excalidraw.com/libraries/${lib.source}`);
              const data = await res.json();
              if (apiRef.current && data.type === "excalidrawlib") {
                apiRef.current.updateLibrary({ libraryItems: data.libraryItems, merge: true, openLibraryMenu: true });
                pushRef.current(`Added ${lib.name} to your library.`);
              }
              setLibraryBrowserOpen(false);
            } catch {
              pushRef.current(`Failed to load ${lib.name}.`);
            }
          }}
        />
      )}

      {profileOpen && <ProfileDialog profile={profile} onClose={() => setProfileOpen(false)}
        onSave={(next) => { onProfileChange(next); setProfileOpen(false); }} />}
      <Toasts toasts={toasts} />
    </div>
  );
}
