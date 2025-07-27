import React, { useContext } from "react";
import GameContext from "../context/GameContext";

function RevealScreen({ handleFinishGame }) {
  const { playersInGame, gameDetails } = useContext(GameContext);
  const characters = gameDetails?.characters || {};
  const killer = Object.values(characters).find((c) => c.isKiller);

  const voteCounts = playersInGame.reduce((acc, player) => {
    if (player.votedFor) {
      acc[player.votedFor] = (acc[player.votedFor] || 0) + 1;
    }
    return acc;
  }, {});

  const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-zinc-700/50">
      <h2 className="text-3xl sm:text-4xl font-playfair-display font-bold text-red-500 mb-6">The Verdict</h2>
      <div className="mb-8">
        <h3 className="text-2xl font-playfair-display font-bold text-zinc-100 mb-4">Final Votes:</h3>
        <ul className="space-y-2">
          {sortedVotes.map(([charId, count]) => {
            const character = characters[charId];
            return (
              <li key={charId} className="text-lg text-zinc-300">
                {character ? `${character.name} (${character.role})` : "Unknown Character"}:{" "}
                <span className="font-bold text-white">{count} vote(s)</span>
              </li>
            );
          })}
        </ul>
      </div>
      {killer && (
        <div className="border-t-2 border-red-800/50 pt-6">
          <h3 className="text-2xl font-playfair-display font-bold text-zinc-100 mb-4">
            The Killer was...
          </h3>
          <img
            src={`https://images.weserv.nl/?url=${encodeURIComponent(killer.idpic)}&w=160&h=160&fit=cover&a=top`}
            alt={killer.name}
            className="w-40 h-40 rounded-full object-cover mx-auto mb-4 border-4 border-red-500 shadow-lg"
          />
          <p className="text-3xl sm:text-4xl font-playfair-display font-bold text-red-500">
            {killer.name}!
          </p>
          <p className="text-lg text-zinc-300">{killer.role}</p>
          <p className="text-xl text-zinc-300 mt-4">Motive:</p>
          <p className="text-zinc-400 italic mt-2">{killer.motive}</p>
        </div>
      )}
      {handleFinishGame && (
        <button
          onClick={handleFinishGame}
          className="mt-8 w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Finish Game & Delete Room
        </button>
      )}
    </div>
  );
}
export default RevealScreen;