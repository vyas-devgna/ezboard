import { useCallback, useEffect, useState } from "react";
import Board from "./Board";
import Dashboard from "./Dashboard";
import { createBoard, findByRoom } from "./lib/boards";
import { getProfile, saveProfile, type Profile } from "./lib/profile";
import { normalizeRoomCode } from "./lib/room-code";

const THEME_KEY = "ezboard.theme";

type Route =
  | { view: "loading" }
  | { view: "dash" }
  | { view: "board"; id: string; room: string | null };

function parseHash(): { kind: "dash" } | { kind: "board"; id: string } | { kind: "room"; code: string } {
  const hash = window.location.hash;
  const board = hash.match(/^#\/b\/([a-f0-9]{16})$/i);
  if (board) return { kind: "board", id: board[1].toLowerCase() };
  const room = normalizeRoomCode(hash.match(/^#\/room\/([A-Z0-9]{5})$/i)?.[1] ?? "");
  if (room) return { kind: "room", code: room };
  return { kind: "dash" };
}

export default function App() {
  const [route, setRoute] = useState<Route>({ view: "loading" });
  const [profile, setProfile] = useState<Profile>(getProfile);
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#17171d" : "#fbfbfd");
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const parsed = parseHash();
      if (parsed.kind === "board") {
        setRoute({ view: "board", id: parsed.id, room: null });
      } else if (parsed.kind === "room") {
        // A room link opens the board already tied to that session, or creates one.
        const existing = await findByRoom(parsed.code);
        const meta = existing ?? await createBoard(`Shared · ${parsed.code}`, parsed.code);
        if (!cancelled) setRoute({ view: "board", id: meta.id, room: parsed.code });
      } else {
        setRoute({ view: "dash" });
      }
    };
    void resolve();
    const onHash = () => void resolve();
    window.addEventListener("hashchange", onHash);
    return () => { cancelled = true; window.removeEventListener("hashchange", onHash); };
  }, []);

  const updateProfile = useCallback((next: Profile) => setProfile(saveProfile(next)), []);
  const toggleTheme = useCallback(() => setDark((value) => !value), []);

  if (route.view === "loading") return null;
  return route.view === "board"
    ? <Board key={route.id} boardId={route.id} autoRoom={route.room} dark={dark} onToggleTheme={toggleTheme} profile={profile} onProfileChange={updateProfile} />
    : <Dashboard dark={dark} onToggleTheme={toggleTheme} profile={profile} onProfileChange={updateProfile} />;
}
