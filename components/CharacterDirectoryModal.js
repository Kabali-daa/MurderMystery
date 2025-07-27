import React from "react";

function CharacterDirectoryModal({ characters, players, onClose }) {
  const assignedCharacterIds = players.map(p => p.characterId).filter(Boolean);
  const characterList = Object.values(characters).filter(c => c.id !== "rajinikanth" && assignedCharacterIds.includes(c.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-4xl w-full border border-zinc-700 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-zinc-400 hover:text-white text-3xl leading-none" aria-label="Close">&times;</button>
        <h3 className="text-2xl sm:text-3xl font-playfair-display font-bold text-red-500 mb-6 text-center">Cast of Characters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-2">
          {characterList.map(char => {
            const player = players.find(p => p.characterId === char.id);
            return (
              <div key={char.id} className="bg-zinc-800/80 p-4 rounded-lg text-center">
                <img src={`https://images.weserv.nl/?url=${encodeURIComponent(char.idpic)}&w=128&h=128&fit=cover&a=top`} alt={char.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-zinc-700" />
                <h4 className="text-xl font-bold text-zinc-100">{char.name}</h4>
                <p className="text-sm text-zinc-400">{char.role}</p>
                <p className="text-sm text-zinc-500 mt-2">Played by: {player?.name || "Unassigned"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CharacterDirectoryModal;