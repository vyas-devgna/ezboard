import { describe, expect, it } from "vitest";
import { generateRoomCode, normalizeRoomCode, ROOM_ALPHABET } from "./room-code";
import { mergeElements } from "./scene";

describe("room codes", () => {
  it("uses only the five-character unambiguous alphabet", () => {
    for (let index = 0; index < 100; index += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(5);
      expect([...code].every((character) => ROOM_ALPHABET.includes(character))).toBe(true);
    }
  });

  it("normalizes valid codes and rejects ambiguous ones", () => {
    expect(normalizeRoomCode("ab-cd2")).toBe("ABCD2");
    expect(normalizeRoomCode("O0IL1")).toBeNull();
  });
});

describe("element merging", () => {
  it("keeps independent updates and selects the newest revision", () => {
    const result = mergeElements(
      [{ id: "a", version: 1, versionNonce: 1 }, { id: "b", version: 1, versionNonce: 1 }],
      [{ id: "a", version: 2, versionNonce: 1 }, { id: "c", version: 1, versionNonce: 1 }],
    );
    expect(result).toEqual([
      { id: "a", version: 2, versionNonce: 1 },
      { id: "b", version: 1, versionNonce: 1 },
      { id: "c", version: 1, versionNonce: 1 },
    ]);
  });
});
