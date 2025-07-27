import React from "react";

/**
 * Modal to show full details of a clue.
 */
function ClueDetailModal({ clue, isUnlocked, characters, onClose, onToggleClue }) {
  const renderClueContent = clue => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const googleDriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const urls = clue.content.match(urlRegex);
    let textContent = clue.content;

    const mediaElement = () => {
      if (!urls || urls.length === 0) return null;
      const firstUrl = urls[0];
      textContent = textContent.replace(firstUrl, "").trim();
      const googleDriveMatch = firstUrl.match(googleDriveRegex);

      if (googleDriveMatch) {
        const fileId = googleDriveMatch[1];
        if (clue.type === "image" || clue.type === "audio") {
          return <iframe src={`https://drive.google.com/file/d/${fileId}/preview`} className="mt-2 w-full h-48 rounded-md" frameBorder="0"></iframe>;
        }
      }

      switch (clue.type) {
        case "image":
          const proxiedImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
          return <img src={proxiedImageUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={e => { e.target.onerror = null; e.target.src = "https://placehold.co/300x200/000000/FFFFFF?text=Image+Error"; }} />;
        case "audio":
          return <audio controls src={firstUrl} className="mt-2 w-full"></audio>;
        case "video":
          return <video controls src={firstUrl} className="mt-2 w-full"></video>;
        default:
          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(firstUrl)) {
            const defaultProxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
            return <img src={defaultProxiedUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={e => { e.target.onerror = null; e.target.src = "https://placehold.co/300x200/000000/FFFFFF?text=Image+Error"; }} />;
          }
          return <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{firstUrl}</a>;
      }
    };

    return (
      <>
        {mediaElement()}
        {textContent && <p className="text-zinc-300 mt-2">{textContent}</p>}
      </>
    );
  };

  // Handles action and then closes modal
  const handleToggleAndClose = () => {
    onToggleClue(clue.id, isUnlocked);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full border border-zinc-700 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-zinc-400 hover:text-white text-3xl leading-none" aria-label="Close">&times;</button>
        <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">{clue.description}</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Regarding: {characters[clue.characterId]?.name || "Unknown"} | Round {clue.round}
        </p>
        <div className="mb-6 max-h-[50vh] overflow-y-auto p-2 bg-black/20 rounded">
          {renderClueContent(clue)}
        </div>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleToggleAndClose}
            className={`px-6 py-2 rounded-lg font-bold transition duration-300 ease-in-out shadow-md ${
              isUnlocked
                ? "bg-yellow-600 hover:bg-yellow-700 text-black"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {isUnlocked ? "Lock This Clue" : "Unlock This Clue"}
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClueDetailModal;