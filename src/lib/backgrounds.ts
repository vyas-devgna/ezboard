import type { CSSProperties } from "react";

export type PatternId = "blank" | "dots" | "grid" | "lines" | "graph";
export type ToneId = "default" | "warm" | "cool" | "mint" | "rose";

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "lines", label: "Ruled" },
  { id: "graph", label: "Graph" },
];

export const TONES: { id: ToneId; label: string; light: string; dark: string }[] = [
  { id: "default", label: "Paper", light: "#fbfbfd", dark: "#17171d" },
  { id: "warm", label: "Warm", light: "#fbf7ef", dark: "#1c1915" },
  { id: "cool", label: "Cool", light: "#f2f6fb", dark: "#141a22" },
  { id: "mint", label: "Mint", light: "#f1f8f4", dark: "#13201a" },
  { id: "rose", label: "Rose", light: "#fbf3f6", dark: "#201419" },
];

export function toneColor(tone: ToneId, dark: boolean): string {
  const entry = TONES.find((t) => t.id === tone) ?? TONES[0];
  return dark ? entry.dark : entry.light;
}

const CELL = 24; // scene units per pattern cell

/**
 * CSS for the pattern layer sitting behind the (transparent) Excalidraw canvas.
 * Viewport position of scene point p is (p + scroll) * zoom, so the pattern is
 * scaled by zoom and offset by scroll*zoom to stay glued to the scene.
 */
export function patternStyle(
  pattern: PatternId,
  tone: ToneId,
  dark: boolean,
  view: { scrollX: number; scrollY: number; zoom: number },
): CSSProperties {
  const base: CSSProperties = { backgroundColor: toneColor(tone, dark) };
  if (pattern === "blank") return base;

  let size = CELL * view.zoom;
  while (size < 14) size *= 2; // zoomed far out: coarsen instead of moiré
  while (size > 96) size /= 2;
  const x = ((view.scrollX * view.zoom) % size + size) % size;
  const y = ((view.scrollY * view.zoom) % size + size) % size;
  const ink = dark ? "rgba(255,255,255,0.09)" : "rgba(38,38,68,0.10)";
  const faint = dark ? "rgba(255,255,255,0.045)" : "rgba(38,38,68,0.05)";

  const layers: Record<Exclude<PatternId, "blank">, string> = {
    dots: `radial-gradient(circle, ${ink} 1px, transparent 1.4px)`,
    grid: `linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px)`,
    lines: `linear-gradient(to bottom, ${ink} 1px, transparent 1px)`,
    graph: `linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px), linear-gradient(to right, ${faint} 1px, transparent 1px), linear-gradient(to bottom, ${faint} 1px, transparent 1px)`,
  };
  const sizes: Record<Exclude<PatternId, "blank">, string> = {
    dots: `${size}px ${size}px`,
    grid: `${size}px ${size}px, ${size}px ${size}px`,
    lines: `${size}px ${size}px`,
    graph: `${size * 4}px ${size * 4}px, ${size * 4}px ${size * 4}px, ${size}px ${size}px, ${size}px ${size}px`,
  };
  return {
    ...base,
    backgroundImage: layers[pattern],
    backgroundSize: sizes[pattern],
    backgroundPosition: `${x}px ${y}px`,
  };
}
