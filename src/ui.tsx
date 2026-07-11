import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ACCENTS, readAvatar, sanitizeName, type Profile } from "./lib/profile";

/* ---------- icons ---------- */

const PATHS: Record<string, string> = {
  back: "M19 12H5M12 19l-7-7 7-7",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  copy: "M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6",
  edit: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  leave: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  sun: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  shapes: "M8.3 10a.7.7 0 0 1-.63-1.08L11.4 3a.7.7 0 0 1 1.2-.04L16.3 8.9a.7.7 0 0 1-.57 1.1ZM3 14h7v7H3zM21 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z",
  grid: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
  kebab: "M12 5.5v.01M12 12v.01M12 18.5v.01",
  spinner: "M21 12a9 9 0 1 1-6.2-8.56",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS & string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={name === "kebab" ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- avatars ---------- */

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function Avatar({ name, accent, avatar, size = 30, ring = false }: {
  name: string; accent: string; avatar?: string; size?: number; ring?: boolean;
}) {
  return (
    <span className={`avatar ${ring ? "ring" : ""}`} title={name}
      style={{ width: size, height: size, backgroundColor: accent, fontSize: size * 0.37, color: accent }}>
      {avatar ? <img src={avatar} alt="" /> : <b>{initials(name)}</b>}
    </span>
  );
}

/* ---------- toasts ---------- */

export type Toast = { id: number; text: string };
let toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = ++toastId;
    setToasts((current) => [...current.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  return { toasts, push };
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => <div className="toast" key={toast.id}>{toast.text}</div>)}
    </div>
  );
}

/* ---------- modal ---------- */

export function Modal({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${className}`} role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        {children}
      </section>
    </div>
  );
}

/* ---------- profile dialog ---------- */

export function ProfileDialog({ profile, onClose, onSave }: {
  profile: Profile; onClose: () => void; onSave: (profile: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [accent, setAccent] = useState(profile.accent);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.select(), []);
  const save = () => onSave({ ...profile, name: sanitizeName(name) || "You", accent, avatar });
  return (
    <Modal onClose={onClose} className="profile-modal">
      <p className="eyebrow">YOUR PRESENCE</p>
      <h1>How others see you.</h1>
      <div className="profile-row">
        <Avatar name={name || "You"} accent={accent} avatar={avatar} size={52} />
        <label className="avatar-upload">
          Add photo
          <input type="file" accept="image/*" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try { setAvatar(await readAvatar(file)); setError(""); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "Could not use that image."); }
          }} />
        </label>
        {avatar && <button className="text-button" onClick={() => setAvatar(undefined)}>Remove</button>}
      </div>
      <label className="field">Name
        <input ref={inputRef} value={name} maxLength={40} onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()} />
      </label>
      <div className="swatches">
        {ACCENTS.map((color) => (
          <button key={color} className={accent === color ? "selected" : ""} style={{ backgroundColor: color }}
            onClick={() => setAccent(color)} aria-label={`Choose ${color}`} />
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary wide" onClick={save}>Save</button>
    </Modal>
  );
}

/* ---------- misc ---------- */

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}
