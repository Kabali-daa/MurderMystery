import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function HostVotingDashboard() {
  const { gameId, showConfirmation } = useContext(AuthContext);
  const { playersInGame } = useContext(GameContext);

  const allPlayersVoted = playersInGame.every(
    (p) => p.votedFor || p.characterId === "host"
  );

  const handleRevealKiller = async () => {
    if (!gameId) return;
    showConfirmation("Are you sure you want to reveal the killer? This cannot be undone.", async () => {
      try {
        const gameDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}`);
        await updateDoc(gameDocRef, { gamePhase: "reveal" });
      } catch (e) {
        // ignore
      }
    });
  };

  return (
    <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-zinc-700/50">
      <h2 className="text-3xl font-playfair-display font-bold text-red-500 mb-6">Live Voting Tally</h2>
      <ul className="space-y-3 mb-8">
        {playersInGame.map((player) => (
          <li key={player.id} className="flex justify-between items-center bg-zinc-800/80 p-3 rounded-lg">
            <span className="text-zinc-100">{player.name}</span>
            {player.votedFor ? (
              <span className="text-green-400 font-bold">Voted</span>
            ) : (
              <span className="text-yellow-400 animate-pulse">Waiting...</span>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={handleRevealKiller}
        disabled={!allPlayersVoted}
        className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {allPlayersVoted ? "Reveal The Killer" : "Waiting for all votes..."}
      </button>
    </div>
  );
}

export default HostVotingDashboard;