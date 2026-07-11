import type { PatternId, ToneId } from "./backgrounds";

export type BoardMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  room: string | null;
  thumb?: string;
};

export type BoardScene = {
  elements: unknown[];
  files: Record<string, unknown>;
  background: { pattern: PatternId; tone: ToneId };
};

export const EMPTY_SCENE: BoardScene = {
  elements: [],
  files: {},
  background: { pattern: "dots", tone: "default" },
};

const LEGACY_KEY = "ezboard.board.v1";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("ezboard", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("meta", { keyPath: "id" });
      request.result.createObjectStore("scenes");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name: "meta" | "scenes", mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listBoards(): Promise<BoardMeta[]> {
  const all = await req((await store("meta", "readonly")).getAll() as IDBRequest<BoardMeta[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMeta(id: string): Promise<BoardMeta | undefined> {
  return req((await store("meta", "readonly")).get(id) as IDBRequest<BoardMeta | undefined>);
}

export async function loadScene(id: string): Promise<BoardScene> {
  const scene = await req((await store("scenes", "readonly")).get(id) as IDBRequest<BoardScene | undefined>);
  return scene ? { ...EMPTY_SCENE, ...scene, background: { ...EMPTY_SCENE.background, ...scene.background } } : structuredClone(EMPTY_SCENE);
}

export async function createBoard(name: string, room: string | null = null, scene?: BoardScene): Promise<BoardMeta> {
  const meta: BoardMeta = { id: newId(), name, createdAt: Date.now(), updatedAt: Date.now(), room };
  await req((await store("meta", "readwrite")).put(meta));
  if (scene) await saveScene(meta.id, scene);
  return meta;
}

export async function updateMeta(id: string, patch: Partial<BoardMeta>): Promise<void> {
  const meta = await getMeta(id);
  if (meta) await req((await store("meta", "readwrite")).put({ ...meta, ...patch, id }));
}

export async function saveScene(id: string, scene: BoardScene): Promise<void> {
  await req((await store("scenes", "readwrite")).put(scene, id));
  await updateMeta(id, { updatedAt: Date.now() });
}

export async function removeBoard(id: string): Promise<void> {
  await req((await store("meta", "readwrite")).delete(id));
  await req((await store("scenes", "readwrite")).delete(id));
}

export async function duplicateBoard(id: string): Promise<BoardMeta | null> {
  const [meta, scene] = [await getMeta(id), await loadScene(id)];
  if (!meta) return null;
  return createBoard(`${meta.name} copy`, null, scene);
}

export async function findByRoom(code: string): Promise<BoardMeta | undefined> {
  return (await listBoards()).find((board) => board.room === code);
}

/** One-time import of the pre-dashboard single board stored in localStorage. */
export async function migrateLegacyBoard(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { elements?: unknown[]; files?: Record<string, unknown> };
    if (Array.isArray(parsed.elements) && parsed.elements.length) {
      await createBoard("My board", null, { ...structuredClone(EMPTY_SCENE), elements: parsed.elements, files: parsed.files ?? {} });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // A corrupt legacy board should never block the dashboard.
  }
}
