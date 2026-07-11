import { describe, expect, it } from "vitest";
import { libraryAssetUrl, readLibraryItems } from "./remote-library";

describe("remote libraries", () => {
  it("builds catalog asset URLs without duplicating the libraries path", () => {
    expect(libraryAssetUrl("jumpingrivers/r.excalidrawlib"))
      .toBe("https://libraries.excalidraw.com/libraries/jumpingrivers/r.excalidrawlib");
  });

  it("accepts both Excalidraw library payload shapes", () => {
    expect(readLibraryItems({ libraryItems: [1] })).toEqual([1]);
    expect(readLibraryItems({ library: [2] })).toEqual([2]);
    expect(readLibraryItems({ libraryItems: "bad" })).toEqual([]);
  });
});
