import { describe, expect, it } from "vitest";
import { diffElements, mergeElements, versionKey } from "./scene";

const el = (id: string, version: number, versionNonce = 1) => ({ id, version, versionNonce });

describe("mergeElements", () => {
  it("keeps the newer version of each element", () => {
    const merged = mergeElements([el("a", 2), el("b", 1)], [el("a", 1), el("b", 3), el("c", 1)]);
    const byId = new Map(merged.map((e) => [e.id, e]));
    expect(byId.get("a")!.version).toBe(2);
    expect(byId.get("b")!.version).toBe(3);
    expect(byId.has("c")).toBe(true);
  });

  it("breaks version ties with the nonce so peers converge", () => {
    const merged = mergeElements([el("a", 2, 5)], [el("a", 2, 9)]);
    expect(merged[0].versionNonce).toBe(9);
  });
});

describe("diffElements", () => {
  it("returns only elements not yet broadcast at their current version", () => {
    const sent = new Map([["a", versionKey(el("a", 1))], ["b", versionKey(el("b", 2))]]);
    const dirty = diffElements([el("a", 2), el("b", 2), el("c", 1)], sent);
    expect(dirty.map((e) => e.id)).toEqual(["a", "c"]);
  });
});
