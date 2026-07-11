import type { ReactNode } from "react";
import { STENCILS, type Stencil, type StencilSection } from "./lib/library";
import { Icon } from "./ui";

/* Miniature previews drawn with the same vocabulary as the stencils themselves. */
const G: Record<string, ReactNode> = {
  client: <rect x="4" y="8" width="20" height="12" rx="2" />,
  service: <rect x="5" y="9" width="18" height="10" rx="2" />,
  database: <><ellipse cx="14" cy="8" rx="8" ry="3" /><path d="M6 8v11c0 1.7 3.6 3 8 3s8-1.3 8-3V8" /></>,
  cache: <rect x="5" y="9" width="18" height="10" rx="2" strokeDasharray="3 2.4" />,
  queue: <><rect x="4" y="9" width="20" height="10" rx="2" /><path d="M15 11v6M18.5 11v6" /></>,
  lb: <path d="M14 5 24 14 14 23 4 14Z" />,
  gateway: <><rect x="4" y="9" width="20" height="10" rx="2" /><path d="M11 12l3 2-3 2M16 16h4" strokeWidth="1.4" /></>,
  cloud: <path d="M9 20a5 5 0 0 1-.6-9.9A6.5 6.5 0 0 1 21 12.4 4 4 0 0 1 20 20Z" />,
  user: <><circle cx="14" cy="10" r="4" /><path d="M6 22a8 8 0 0 1 16 0" /></>,
  sticky: <><rect x="6" y="6" width="16" height="16" rx="1.5" /><path d="M16 22v-6h6" /></>,
  decision: <><path d="M14 4 24 14 14 24 4 14Z" /><path d="M14 11v4M14 18v.01" strokeWidth="1.6" /></>,
  zone: <rect x="4" y="6" width="20" height="16" rx="2.5" strokeDasharray="3.4 2.6" />,
  browser: <><rect x="4" y="6" width="20" height="16" rx="2" /><path d="M4 11h20M7 8.5h.01M9.6 8.5h.01M12.2 8.5h.01" /></>,
  phone: <><rect x="8.5" y="4" width="11" height="20" rx="2.5" /><path d="M12 21h4" /></>,
  button: <rect x="5" y="10" width="18" height="8" rx="4" />,
  input: <><rect x="4" y="10" width="20" height="8" rx="2" /><path d="M8 12.5v3" /></>,
  card: <><rect x="5" y="6" width="18" height="16" rx="2" /><path d="M8 11h8M8 14.5h10M8 18h6" strokeWidth="1.3" /></>,
  modal: <><rect x="5" y="7" width="18" height="14" rx="2" /><path d="M8 11h8M15 17h5" strokeWidth="1.3" /></>,
};

const SECTIONS: StencilSection[] = ["System design", "Brainstorm", "UI wireframe"];

export default function Library({ onInsert, onClose }: {
  onInsert: (stencil: Stencil) => void;
  onClose: () => void;
}) {
  return (
    <aside className="library" aria-label="Shape library">
      <header>
        <strong>Library</strong>
        <button className="ghost-icon" onClick={onClose} aria-label="Close library"><Icon name="x" size={15} /></button>
      </header>
      <div className="library-scroll">
        {SECTIONS.map((section) => (
          <section key={section}>
            <h3>{section}</h3>
            <div className="stencil-grid">
              {STENCILS.filter((stencil) => stencil.section === section).map((stencil) => (
                <button key={stencil.id} className="stencil" onClick={() => onInsert(stencil)} title={`Insert ${stencil.label}`}>
                  <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {G[stencil.id]}
                  </svg>
                  <span>{stencil.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
