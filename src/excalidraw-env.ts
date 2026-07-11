declare global {
  interface Window { EXCALIDRAW_ASSET_PATH?: string }
}

// Must run before the excalidraw module evaluates: it resolves its runtime
// chunk/font base path at import time (CSP forbids its unpkg default).
window.EXCALIDRAW_ASSET_PATH = "/"; // it appends "excalidraw-assets/" itself

export {};
