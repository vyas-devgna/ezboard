import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

type VersionedElement = Pick<ExcalidrawElement, "id" | "version" | "versionNonce">;

export function isNewerElement(
  incoming: VersionedElement,
  current: VersionedElement,
): boolean {
  return (
    incoming.version > current.version ||
    (incoming.version === current.version && incoming.versionNonce > current.versionNonce)
  );
}

export function mergeElements<T extends VersionedElement>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const merged = new Map(current.map((element) => [element.id, element]));
  for (const element of incoming) {
    const existing = merged.get(element.id);
    if (!existing || isNewerElement(element, existing)) merged.set(element.id, element);
  }
  return [...merged.values()];
}
