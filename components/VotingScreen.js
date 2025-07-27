import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function VotingScreen() {
  const { userId, gameId, showModalMessage } = useContext(AuthContext);
  const { playersInGame, gameDetails } = useContext(GameContext);
  const myPlayer = playersInGame.find((p) => p.id === userId);

  const handleVote = async (accusedId) => {
    if (!myPlayer || myPlayer.votedFor) {
      showModalMessage("You have already voted.");
      return;
    }
    try {
      const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${userId}`);
      await updateDoc(playerDocRef, { votedFor: accusedId });
      showModalMessage("Your vote has been cast!");
    } catch (e) {
      showModalMessage("Failed to cast your vote. Please try again.");
    }
  };

  if (myPlayer?.votedFor) {
    return (
      <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-zinc-700/50">
        <h2 className="text-3xl font-playfair-display font-bold text-red-500 mb-4">Vote Cast!</h2>
        <p className="text-zinc-300">
          You have accused {gameDetails.characters[myPlayer.votedFor]?.name}.
        </p>
        <p className="text-zinc-400 mt-4">Waiting for the host to reveal the killer...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-zinc-700/50">
      <h2 className="text-3xl sm:text-4xl font-playfair-display font-bold text-center text-red-500 mb-6">
        Who is the Killer?
      </h2>
      <p className="text-center text-zinc-300 mb-8">
        The investigation is over. It's time to make your final accusation.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {playersInGame.map((player) => {
          const character = gameDetails.characters[player.characterId];
          if (!character || character.id === "rajinikanth") return null;
          return (
            <div
              key={player.id}
              onClick={() => handleVote(player.characterId)}
              className="bg-zinc-800/80 p-4 rounded-lg shadow-lg text-center cursor-pointer hover:bg-red-900/80 hover:scale-105 transition-transform duration-200"
            >
              <img
                src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=128&h=128&fit=cover&a=top`}
                alt={character.name}
                className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-zinc-700"
              />
              <h3 className="text-xl font-bold text-zinc-100">{character.name}</h3>
              <p className="text-sm text-zinc-400">{character.role}</p>
              <p className="text-sm text-zinc-500 mt-2">Played by: {player.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VotingScreen;