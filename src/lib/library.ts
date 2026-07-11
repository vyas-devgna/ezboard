import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

export type StencilSection = "System design" | "Brainstorm" | "UI wireframe";

export type Stencil = {
  id: string;
  label: string;
  section: StencilSection;
  w: number;
  h: number;
  make: (x: number, y: number) => ExcalidrawElementSkeleton[];
};

const ROUND = { type: 3 } as const;

const box = (
  x: number, y: number, w: number, h: number, text: string,
  stroke: string, bg: string, extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton => ({
  type: "rectangle", x, y, width: w, height: h,
  strokeColor: stroke, backgroundColor: bg, fillStyle: "solid", roundness: ROUND,
  label: { text, fontSize: 16, strokeColor: stroke },
  ...extra,
} as ExcalidrawElementSkeleton);

export const STENCILS: Stencil[] = [
  // — System design —
  {
    id: "client", label: "Client", section: "System design", w: 140, h: 70,
    make: (x, y) => [box(x, y, 140, 70, "Client", "#1971c2", "#d0ebff")],
  },
  {
    id: "service", label: "Service", section: "System design", w: 150, h: 70,
    make: (x, y) => [box(x, y, 150, 70, "Service", "#6741d9", "#e5dbff")],
  },
  {
    id: "database", label: "Database", section: "System design", w: 120, h: 104,
    make: (x, y) => [
      box(x, y + 14, 120, 90, "DB", "#2f9e44", "#d3f9d8", { roundness: null }),
      { type: "ellipse", x, y, width: 120, height: 28, strokeColor: "#2f9e44", backgroundColor: "#d3f9d8", fillStyle: "solid" },
    ],
  },
  {
    id: "cache", label: "Cache", section: "System design", w: 130, h: 64,
    make: (x, y) => [box(x, y, 130, 64, "Cache", "#e8590c", "#ffe8cc", { strokeStyle: "dashed" })],
  },
  {
    id: "queue", label: "Queue", section: "System design", w: 170, h: 60,
    make: (x, y) => [
      box(x, y, 170, 60, "Queue", "#f08c00", "#fff3bf"),
      ...[0, 1, 2].map((i) => ({
        type: "line" as const, x: x + 128 + i * 13, y: y + 12, width: 0, height: 36,
        points: [[0, 0], [0, 36]] as unknown as ExcalidrawElement[][], strokeColor: "#f08c00",
      }) as unknown as ExcalidrawElementSkeleton),
    ],
  },
  {
    id: "lb", label: "Load balancer", section: "System design", w: 130, h: 90,
    make: (x, y) => [{
      type: "diamond", x, y, width: 130, height: 90,
      strokeColor: "#0c8599", backgroundColor: "#c5f6fa", fillStyle: "solid",
      label: { text: "LB", fontSize: 16, strokeColor: "#0c8599" },
    } as ExcalidrawElementSkeleton],
  },
  {
    id: "gateway", label: "API gateway", section: "System design", w: 160, h: 64,
    make: (x, y) => [box(x, y, 160, 64, "API Gateway", "#c2255c", "#ffdeeb")],
  },
  {
    id: "cloud", label: "Cloud / CDN", section: "System design", w: 150, h: 80,
    make: (x, y) => [{
      type: "ellipse", x, y, width: 150, height: 80,
      strokeColor: "#495057", backgroundColor: "#f1f3f5", fillStyle: "solid",
      label: { text: "Cloud", fontSize: 16, strokeColor: "#495057" },
    } as ExcalidrawElementSkeleton],
  },
  {
    id: "user", label: "User", section: "System design", w: 90, h: 90,
    make: (x, y) => [{
      type: "ellipse", x, y, width: 90, height: 90,
      strokeColor: "#1971c2", backgroundColor: "#e7f5ff", fillStyle: "solid",
      label: { text: "User", fontSize: 14, strokeColor: "#1971c2" },
    } as ExcalidrawElementSkeleton],
  },
  // — Brainstorm —
  {
    id: "sticky", label: "Sticky note", section: "Brainstorm", w: 160, h: 160,
    make: (x, y) => [box(x, y, 160, 160, "Idea", "#e8590c", "#ffec99", { strokeColor: "transparent", roundness: null })],
  },
  {
    id: "decision", label: "Decision", section: "Brainstorm", w: 140, h: 100,
    make: (x, y) => [{
      type: "diamond", x, y, width: 140, height: 100,
      strokeColor: "#e03131", backgroundColor: "#ffc9c9", fillStyle: "solid",
      label: { text: "?", fontSize: 20, strokeColor: "#e03131" },
    } as ExcalidrawElementSkeleton],
  },
  {
    id: "zone", label: "Zone", section: "Brainstorm", w: 320, h: 220,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 320, height: 220, strokeColor: "#868e96", backgroundColor: "transparent", strokeStyle: "dashed", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "text", x: x + 12, y: y + 10, text: "Zone", fontSize: 16, strokeColor: "#868e96" } as ExcalidrawElementSkeleton,
    ],
  },
  // — UI wireframe —
  {
    id: "browser", label: "Browser", section: "UI wireframe", w: 300, h: 200,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 300, height: 200, strokeColor: "#343a40", backgroundColor: "#ffffff", fillStyle: "solid", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "line", x, y: y + 30, points: [[0, 0], [300, 0]] as unknown as ExcalidrawElement[][], strokeColor: "#343a40" } as unknown as ExcalidrawElementSkeleton,
      ...[0, 1, 2].map((i) => ({
        type: "ellipse" as const, x: x + 10 + i * 14, y: y + 11, width: 8, height: 8,
        strokeColor: "#343a40", backgroundColor: "#ced4da", fillStyle: "solid",
      }) as ExcalidrawElementSkeleton),
    ],
  },
  {
    id: "phone", label: "Phone", section: "UI wireframe", w: 150, h: 300,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 150, height: 300, strokeColor: "#343a40", backgroundColor: "#ffffff", fillStyle: "solid", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "line", x: x + 55, y: y + 285, points: [[0, 0], [40, 0]] as unknown as ExcalidrawElement[][], strokeColor: "#343a40", strokeWidth: 2 } as unknown as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "button", label: "Button", section: "UI wireframe", w: 110, h: 40,
    make: (x, y) => [box(x, y, 110, 40, "Button", "#1971c2", "#a5d8ff")],
  },
  {
    id: "input", label: "Input", section: "UI wireframe", w: 220, h: 44,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 220, height: 44, strokeColor: "#868e96", backgroundColor: "#ffffff", fillStyle: "solid", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "text", x: x + 12, y: y + 12, text: "Type here…", fontSize: 14, strokeColor: "#adb5bd" } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "card", label: "Card", section: "UI wireframe", w: 200, h: 140,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 200, height: 140, strokeColor: "#868e96", backgroundColor: "#ffffff", fillStyle: "solid", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "text", x: x + 14, y: y + 14, text: "Title", fontSize: 16, strokeColor: "#343a40" } as ExcalidrawElementSkeleton,
      { type: "rectangle", x: x + 14, y: y + 48, width: 172, height: 10, strokeColor: "transparent", backgroundColor: "#dee2e6", fillStyle: "solid" } as ExcalidrawElementSkeleton,
      { type: "rectangle", x: x + 14, y: y + 66, width: 120, height: 10, strokeColor: "transparent", backgroundColor: "#dee2e6", fillStyle: "solid" } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "modal", label: "Modal", section: "UI wireframe", w: 240, h: 160,
    make: (x, y) => [
      { type: "rectangle", x, y, width: 240, height: 160, strokeColor: "#343a40", backgroundColor: "#ffffff", fillStyle: "solid", roundness: ROUND } as ExcalidrawElementSkeleton,
      { type: "text", x: x + 16, y: y + 14, text: "Modal title", fontSize: 16, strokeColor: "#343a40" } as ExcalidrawElementSkeleton,
      box(x + 130, y + 108, 94, 36, "OK", "#1971c2", "#a5d8ff"),
    ],
  },
];

function randomGroupId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36)).join("").slice(0, 16);
}

/** Convert a stencil to real elements centered on (cx, cy), grouped so it moves as one unit. */
export function buildStencil(stencil: Stencil, cx: number, cy: number): ExcalidrawElement[] {
  const elements = convertToExcalidrawElements(stencil.make(cx - stencil.w / 2, cy - stencil.h / 2));
  const groupId = randomGroupId();
  return elements.map((element) =>
    "containerId" in element && element.containerId
      ? element
      : { ...element, groupIds: [...element.groupIds, groupId] },
  );
}
