import React, { useContext } from "react";
import GameContext from "../context/GameContext";

function WaitingForAssignmentScreen() {
  const { gameDetails } = useContext(GameContext);
  const victim = gameDetails?.characters ? gameDetails.characters["rajinikanth"] : null;

  return (
    <div className="w-full max-w-lg bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-zinc-700/50 text-center">
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-red-500 mb-4">Welcome!</h2>
      <p className="text-zinc-300 text-lg mb-4">You have successfully joined the game.</p>
      <p className="text-zinc-400">Please wait for the host to assign your character.</p>
      <div className="mt-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
      </div>
      {victim && (
        <div className="mt-8 text-left p-4 bg-zinc-800/80 rounded-lg">
          <h3 className="text-xl font-playfair-display font-bold text-red-400 mb-3">The Case</h3>
          <p className="text-zinc-300"><span className="font-bold">Victim:</span> {victim.name}</p>
          <p className="text-zinc-300 mt-2">{victim.secretInfo}</p>
        </div>
      )}
    </div>
  );
}

export default WaitingForAssignmentScreen;