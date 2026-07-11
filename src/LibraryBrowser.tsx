import { useEffect, useState } from "react";
import { Icon, Modal } from "./ui";
import { INCLUDED_LIBRARY_COUNT, LIBRARY_CATALOG_URL, libraryAssetUrl } from "./lib/remote-library";

type LibraryItem = {
  id: string;
  name: string;
  description: string;
  source: string;
  preview: string;
};

export function LibraryBrowser({ onClose, onInstall }: { onClose: () => void; onInstall: (library: LibraryItem) => void }) {
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(LIBRARY_CATALOG_URL)
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((data: LibraryItem[]) => {
        setLibraries(data.slice(0, INCLUDED_LIBRARY_COUNT));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Modal onClose={onClose} className="library-browser-modal">
      <p className="eyebrow">TOP LIBRARIES</p>
      <h1>Add to EzBoard</h1>
      {loading ? (
        <div className="loading-spinner"><Icon name="spinner" size={24} /></div>
      ) : error ? (
        <p>Libraries could not be loaded. Check your connection and try again.</p>
      ) : (
        <div className="library-grid">
          {libraries.map((lib) => (
            <div key={lib.id} className="library-card">
              <div className="library-preview">
                <img src={libraryAssetUrl(lib.preview)} alt={lib.name} loading="lazy" />
              </div>
              <div className="library-info">
                <h3>{lib.name}</h3>
                <p>{lib.description}</p>
                <button className="primary small" onClick={() => onInstall(lib)}>Add to Board</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
