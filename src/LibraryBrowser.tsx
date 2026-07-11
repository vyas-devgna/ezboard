import { useEffect, useState } from "react";
import { Icon, Modal } from "./ui";

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

  useEffect(() => {
    fetch("https://libraries.excalidraw.com/libraries.json")
      .then((res) => res.json())
      .then((data: LibraryItem[]) => {
        setLibraries(data.slice(0, 20));
      })
      .catch(() => {
        // Handle error gracefully
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Modal onClose={onClose} className="library-browser-modal">
      <p className="eyebrow">TOP LIBRARIES</p>
      <h1>Add to EzBoard</h1>
      {loading ? (
        <div className="loading-spinner"><Icon name="spinner" size={24} /></div>
      ) : (
        <div className="library-grid">
          {libraries.map((lib) => (
            <div key={lib.id} className="library-card">
              <div className="library-preview">
                <img src={`https://libraries.excalidraw.com/${lib.preview}`} alt={lib.name} />
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
