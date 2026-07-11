import { exportToCanvas, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { jsPDF } from "jspdf";

type ExportInput = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function exportBoard(kind: "png" | "svg" | "json" | "pdf", input: ExportInput): Promise<void> {
  const base = `ezboard-${new Date().toISOString().slice(0, 10)}`;
  if (kind === "json") {
    download(new Blob([serializeAsJSON(input.elements, input.appState, input.files, "local")], { type: "application/json" }), `${base}.excalidraw`);
    return;
  }
  if (kind === "svg") {
    const svg = await exportToSvg({ ...input, exportPadding: 24 });
    download(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${base}.svg`);
    return;
  }
  const canvas = await exportToCanvas({ ...input, exportPadding: 24, maxWidthOrHeight: 4096 });
  if (kind === "png") {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) download(blob, `${base}.png`);
    return;
  }
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${base}.pdf`);
}
