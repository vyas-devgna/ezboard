import { useEffect, useState } from "react";
import { createBoard, duplicateBoard, listBoards, migrateLegacyBoard, removeBoard, updateMeta, type BoardMeta } from "./lib/boards";
import type { Profile } from "./lib/profile";
import { normalizeRoomCode } from "./lib/room-code";
import { Avatar, Icon, ProfileDialog, timeAgo, Toasts, useToasts } from "./ui";

export default function Dashboard({ dark, onToggleTheme, profile, onProfileChange }: {
  dark: boolean;
  onToggleTheme: () => void;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}) {
  const [boards, setBoards] = useState<BoardMeta[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toasts, push } = useToasts();

  const refresh = () => void listBoards().then(setBoards);

  useEffect(() => {
    void migrateLegacyBoard().then(refresh);
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuFor]);

  const create = async () => {
    const meta = await createBoard("Untitled board");
    window.location.hash = `/b/${meta.id}`;
  };

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (!code) {
      setJoinError(true);
      push("Codes are 5 letters/digits — no I, L, O, 0 or 1.");
      return;
    }
    window.location.hash = `/room/${code}`;
  };

  return (
    <main className="dash">
      <header className="dash-head">
        <div className="brand">
          <img src="/brand/ezboard-mark.png" alt="" />
          <div className="brand-text"><span>ezboard</span><small>p2p canvas</small></div>
        </div>
        <div className="dash-head-actions">
          <button className="icon-button" onClick={onToggleTheme} title={dark ? "Light mode" : "Dark mode"}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <button className="avatar-button" onClick={() => setProfileOpen(true)} title="Edit your presence">
            <Avatar name={profile.name} accent={profile.accent} avatar={profile.avatar} size={32} />
          </button>
        </div>
      </header>

      <section className="dash-hero">
        <div>
          <h1>Your boards</h1>
          <p>Everything lives in this browser. Share a board to draw together — peer to peer, nothing uploaded.</p>
        </div>
        <div className="dash-hero-actions">
          <form className="join-form" onSubmit={join}>
            <input aria-label="Room code" placeholder="Room code" maxLength={5} value={joinCode}
              className={joinError ? "shake" : ""} onAnimationEnd={() => setJoinError(false)}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
            <button className="secondary" disabled={!joinCode}>Join</button>
          </form>
          <button className="primary" onClick={() => void create()}><Icon name="plus" size={16} /> New board</button>
        </div>
      </section>

      {boards === null ? (
        <div className="dash-loading"><span className="spin"><Icon name="spinner" size={22} /></span></div>
      ) : boards.length === 0 ? (
        <section className="dash-empty" onClick={() => void create()}>
          <Icon name="shapes" size={34} />
          <h2>Nothing here yet</h2>
          <p>Create your first board — sketch systems, wireframes, or anything in between.</p>
          <button className="primary"><Icon name="plus" size={16} /> Create a board</button>
        </section>
      ) : (
        <section className="board-grid">
          {boards.map((board) => (
            <article className="board-card" key={board.id} onClick={() => renaming !== board.id && (window.location.hash = `/b/${board.id}`)}>
              <div className="board-thumb">
                {board.thumb ? <img src={board.thumb} alt="" loading="lazy" /> : <span className="thumb-blank"><Icon name="shapes" size={26} /></span>}
                {board.room && <span className="room-badge"><Icon name="users" size={11} /> {board.room}</span>}
              </div>
              <div className="board-card-row">
                {renaming === board.id ? (
                  <input autoFocus defaultValue={board.name} maxLength={60}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setRenaming(null); }}
                    onBlur={async (event) => {
                      const name = event.target.value.trim();
                      if (name) await updateMeta(board.id, { name });
                      setRenaming(null); refresh();
                    }} />
                ) : (
                  <div className="board-card-text">
                    <strong>{board.name}</strong>
                    <small>{timeAgo(board.updatedAt)}</small>
                  </div>
                )}
                <div className="card-menu-wrap" onClick={(event) => event.stopPropagation()}>
                  <button className="ghost-icon" aria-label="Board actions" onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setMenuFor(menuFor === board.id ? null : board.id)}>
                    <Icon name="kebab" size={16} />
                  </button>
                  {menuFor === board.id && (
                    <div className="menu" onPointerDown={(event) => event.stopPropagation()}>
                      <button onClick={() => { setRenaming(board.id); setMenuFor(null); }}><Icon name="edit" size={14} /> Rename</button>
                      <button onClick={async () => { await duplicateBoard(board.id); setMenuFor(null); refresh(); push("Board duplicated."); }}><Icon name="copy" size={14} /> Duplicate</button>
                      <button className="danger" onClick={async () => {
                        if (window.confirm(`Delete “${board.name}”? This cannot be undone.`)) {
                          await removeBoard(board.id); refresh(); push("Board deleted.");
                        }
                        setMenuFor(null);
                      }}><Icon name="trash" size={14} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
          <button className="board-card new-card" onClick={() => void create()}>
            <Icon name="plus" size={22} />
            <span>New board</span>
          </button>
        </section>
      )}

      <footer className="dash-foot">Boards are stored on this device. Rooms connect browsers directly over WebRTC.</footer>

      {profileOpen && <ProfileDialog profile={profile} onClose={() => setProfileOpen(false)} onSave={(next) => { onProfileChange(next); setProfileOpen(false); push("Saved."); }} />}
      <Toasts toasts={toasts} />
    </main>
  );
}
