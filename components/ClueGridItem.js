import React from "react";

const MagnifyingGlassIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

/**
 * Compact clue grid item for host dashboard, etc.
 */
function ClueGridItem({ clue, characterName, characterRole, characterIdpic, isUnlocked, onToggleClue, onViewClue }) {
  const isImageUrl = characterIdpic && /\.(jpg|jpeg|png|gif|webp)$/i.test(characterIdpic);

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${isUnlocked ? "bg-zinc-800/80" : "bg-zinc-950/70"}`}>
      <div
        onClick={() => onViewClue(clue)}
        className="w-24 h-24 bg-black/40 rounded-md flex items-center justify-center cursor-pointer mb-2 overflow-hidden border-2 border-transparent hover:border-red-500"
        title={`Click to view details for: ${clue.description}`}
      >
        {isImageUrl ? (
          <img
            src={`https://images.weserv.nl/?url=${encodeURIComponent(characterIdpic)}&w=96&h=96&fit=cover&a=top`}
            alt={characterName}
            className="w-full h-full object-cover"
            onError={e => { e.target.onerror = null; e.target.src = "https://placehold.co/96x96/1a1a1a/ffffff?text=Error"; }}
          />
        ) : (
          <MagnifyingGlassIcon />
        )}
      </div>
      <p className="text-sm text-zinc-300 font-semibold w-full text-center truncate" title={characterName}>{characterName}</p>
      <p className="text-xs text-zinc-500 w-full text-center truncate" title={characterRole}>({characterRole})</p>
      <button
        onClick={e => {
          e.stopPropagation();
          onToggleClue(clue.id, isUnlocked);
        }}
        className={`w-full mt-2 px-2 py-1 rounded font-bold text-sm transition duration-300 ease-in-out shadow-md ${
          isUnlocked
            ? "bg-yellow-600 hover:bg-yellow-700 text-black"
            : "bg-green-600 hover:bg-green-700 text-white"
        }`}
      >
        {isUnlocked ? "Lock" : "Unlock"}
      </button>
    </div>
  );
}

export default ClueGridItem;