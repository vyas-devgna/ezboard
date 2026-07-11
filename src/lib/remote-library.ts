export const LIBRARY_CATALOG_URL = "https://libraries.excalidraw.com/libraries.json";
export const INCLUDED_LIBRARY_COUNT = 30;

export function libraryAssetUrl(source: string): string {
  return new URL(source.replace(/^\/+/, ""), "https://libraries.excalidraw.com/libraries/").href;
}

export function readLibraryItems(payload: unknown): LibraryItems_anyVersion {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { libraryItems?: unknown; library?: unknown };
  const items = data.libraryItems ?? data.library;
  return (Array.isArray(items) ? items : []) as LibraryItems_anyVersion;
}
import type { LibraryItems_anyVersion } from "@excalidraw/excalidraw/types/types";
