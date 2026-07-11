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

/** Last-writer-wins merge keyed by element id; version + nonce break ties deterministically on every peer. */
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

/** Version fingerprint used to detect changed elements between broadcasts. */
export function versionKey(element: VersionedElement): string {
  return `${element.version}:${element.versionNonce}`;
}

/** Elements whose fingerprint differs from what was last broadcast (includes deletions, which bump version). */
export function diffElements<T extends VersionedElement>(
  elements: readonly T[],
  sent: ReadonlyMap<string, string>,
): T[] {
  return elements.filter((element) => sent.get(element.id) !== versionKey(element));
}
