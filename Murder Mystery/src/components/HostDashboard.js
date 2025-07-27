import React, { useState, useEffect, useRef, useContext } from "react";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import ClueGridItem from "./ClueGridItem";
import ClueDetailModal from "./ClueDetailModal";
import PublicBoard from "./PublicBoard";
import PrivateChat from "./PrivateChat";

import { doc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

function HostDashboard({ gameDetails, handleResetGame, showConfirmation, setActiveTab, activeTab }) {
  const {
    gameId,
    showModalMessage,
    setUnreadPublicCount,
    setUnreadPrivateChats,
    unreadPublicCount,
    unreadPrivateChats,
    userId,
  } = useContext(AuthContext);
  const { clueStates, playersInGame } = useContext(GameContext);

  const currentRound = gameDetails?.currentRound || 1;
  const characters = gameDetails?.characters || {};
  const allClues = gameDetails?.clues || [];

  const [viewingClue, setViewingClue] = useState(null);
  const [visibleRound, setVisibleRound] = useState(currentRound);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editedPlayer, setEditedPlayer] = useState(null);
  const [notifiedRound, setNotifiedRound] = useState(0);
  const prevPlayerCountRef = useRef(playersInGame.length);

  useEffect(() => {
    setVisibleRound(currentRound);
  }, [currentRound]);

  // Effect for new player notification
  useEffect(() => {
    if (playersInGame.length > prevPlayerCountRef.current) {
      const unassignedPlayers = playersInGame.filter((p) => !p.characterId);
      if (unassignedPlayers.length > 0) {
        showModalMessage("A new player has joined! Go to the 'Player Management' tab to assign them a character.");
      }
    }
    prevPlayerCountRef.current = playersInGame.length;
  }, [playersInGame, showModalMessage]);

  // Effect for round completion notification
  useEffect(() => {
    const assignedCharacterIds = playersInGame.map((p) => p.characterId).filter(Boolean);
    const currentRoundClues = allClues.filter((c) => c.round === currentRound && assignedCharacterIds.includes(c.characterId));
    if (currentRoundClues.length === 0 || currentRound >= 3 || notifiedRound === currentRound) {
      return;
    }
    const allCurrentRoundCluesUnlocked = currentRoundClues.every((c) => clueStates[c.id]?.unlocked);
    if (allCurrentRoundCluesUnlocked) {
      showModalMessage(`All clues for Round ${currentRound} have been revealed! You can now advance to the next round.`);
      setNotifiedRound(currentRound);
    }
  }, [clueStates, currentRound, allClues, showModalMessage, notifiedRound, playersInGame]);

  // --- Clues ---
  const handleViewClue = (clue) => setViewingClue(clue);
  const handleCloseClueModal = () => setViewingClue(null);

  const handleToggleClue = async (clueId, isUnlocked) => {
    if (!gameId) return;
    try {
      const gameDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}`);
      const updatedClues = allClues.map((clue) =>
        clue.id === clueId ? { ...clue, unlocked: !isUnlocked, unlockedAt: new Date().toISOString() } : clue
      );
      await updateDoc(gameDocRef, { clues: updatedClues });
    } catch (e) {
      console.error("Error toggling clue:", e);
      showModalMessage("Failed to update clue. Please try again.");
    }
  };

  // --- Rounds ---
  const handleAdvanceRound = async () => {
    if (!gameId) return;
    if (currentRound >= 3) {
      showModalMessage("You are already at the final round.");
      return;
    }
    try {
      const gameDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}`);
      await updateDoc(gameDocRef, { currentRound: currentRound + 1 });
      showModalMessage(`Advanced to Round ${currentRound + 1}!`);
    } catch (e) {
      console.error("Error advancing round:", e);
      showModalMessage("Failed to advance round. Please try again.");
    }
  };

  // --- Voting ---
  const handleStartVoting = async () => {
    if (!gameId) return;
    showConfirmation("Are you sure you want to end the investigation and start the final voting?", async () => {
      try {
        const gameDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}`);
        await updateDoc(gameDocRef, { gamePhase: "voting" });
        showModalMessage("Voting has begun!");
      } catch (e) {
        console.error("Error starting voting:", e);
        showModalMessage("Failed to start voting phase.");
      }
    });
  };

  // --- Players ---
  const handleEditPlayer = (playerId) => {
    setEditingPlayerId(playerId);
    setEditedPlayer({ ...playersInGame.find((p) => p.id === playerId) });
  };

  const handleSavePlayer = async () => {
    if (!editedPlayer || !gameId || !editingPlayerId) {
      showModalMessage("Player data is missing.");
      return;
    }
    const assignedToAnother = playersInGame.some(
      (p) => p.id !== editingPlayerId && p.characterId && p.characterId === editedPlayer.characterId
    );
    if (assignedToAnother) {
      showModalMessage(`Character ${characters[editedPlayer.characterId].name} is already assigned.`);
      return;
    }
    try {
      const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${editingPlayerId}`);
      await updateDoc(playerDocRef, {
        name: editedPlayer.name,
        characterId: editedPlayer.characterId || null,
      });
      showModalMessage(`Player ${editedPlayer.name}'s details updated.`);
      setEditingPlayerId(null);
      setEditedPlayer(null);
    } catch (e) {
      console.error("Error saving player:", e);
      showModalMessage("Failed to save player details. Please try again.");
    }
  };

  const handleKickPlayer = (playerId) => {
    showConfirmation(
      "Are you sure you want to kick this player? They will be removed from the game.",
      async () => {
        try {
          const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${playerId}`);
          await deleteDoc(playerDocRef);
          showModalMessage("Player kicked successfully.");
          setEditingPlayerId(null);
        } catch (e) {
          console.error("Error kicking player:", e);
          showModalMessage("Failed to kick player. Please try again.");
        }
      }
    );
  };

  const totalUnreadPrivate = Object.values(unreadPrivateChats).reduce((acc, count) => acc + count, 0);

  const handleTabChange = (tabName) => {
    if (tabName === "publicBoard") setUnreadPublicCount(0);
    if (tabName === "privateChats") setUnreadPrivateChats({});
    setActiveTab(tabName);
  };

  if (!gameDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
        <div className="text-xl font-semibold animate-pulse">Loading game...</div>
      </div>
    );
  }

  const assignedCharacterIds = playersInGame.map((p) => p.characterId).filter(Boolean);

  return (
    <div className="w-full lg:max-w-4xl bg-black/50 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-lg border border-zinc-700/50">
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-center mb-6 text-red-500">Host Dashboard</h2>
      <p className="text-lg text-zinc-300 mb-4 text-center">
        Game ID: <span className="font-bold text-red-500">{gameId}</span>
      </p>
      <div className="flex flex-wrap justify-center border-b border-red-800/50 mb-6">
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === "overview" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"}`}
          onClick={() => handleTabChange("overview")}
        >
          Overview
        </button>
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === "players" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"}`}
          onClick={() => handleTabChange("players")}
        >
          Players
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === "publicBoard" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"}`}
          onClick={() => handleTabChange("publicBoard")}
        >
          Public Board
          {unreadPublicCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unreadPublicCount}
            </span>
          )}
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === "privateChats" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"}`}
          onClick={() => handleTabChange("privateChats")}
        >
          Private Chats
          {totalUnreadPrivate > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {totalUnreadPrivate}
            </span>
          )}
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <p className="text-xl text-zinc-300 mb-6 text-center">
            Current Round: <span className="font-bold text-red-500">{currentRound}</span>
          </p>
          <div className="mb-8 flex flex-col space-y-4">
            {currentRound < 3 ? (
              <button
                onClick={handleAdvanceRound}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
              >
                Advance to Round {currentRound + 1}
              </button>
            ) : (
              <button
                onClick={handleStartVoting}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
              >
                Let's Begin Voting
              </button>
            )}
            <button
              onClick={handleResetGame}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Reset Game
            </button>
          </div>
          <div className="flex justify-center items-center space-x-2 mb-6 border-b border-t border-zinc-700 py-3">
            <span className="text-zinc-300 font-bold">View Round:</span>
            {Array.from({ length: currentRound }, (_, i) => i + 1).map((roundNum) => (
              <button
                key={roundNum}
                onClick={() => setVisibleRound(roundNum)}
                className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${visibleRound === roundNum ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"}`}
              >
                {roundNum}
              </button>
            ))}
          </div>
          <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">Clues for Round {visibleRound}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allClues
              .filter((clue) => clue.round === visibleRound && assignedCharacterIds.includes(clue.characterId))
              .map((clue) => {
                const character = characters[clue.characterId];
                return (
                  <ClueGridItem
                    key={clue.id}
                    clue={clue}
                    characterName={character.name}
                    characterRole={character.role}
                    characterIdpic={character.idpic}
                    isUnlocked={clueStates[clue.id]?.unlocked || false}
                    onToggleClue={handleToggleClue}
                    onViewClue={handleViewClue}
                  />
                );
              })}
          </div>
        </>
      )}

      {activeTab === "players" && (
        <div className="bg-black/30 p-4 rounded-lg shadow-lg border border-zinc-700/50">
          <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">Manage Players</h3>
          {playersInGame.length === 0 ? (
            <p className="text-zinc-400">No players have joined yet.</p>
          ) : (
            <ul className="space-y-3">
              {playersInGame.map((player) => {
                const character = characters[player.characterId];
                return (
                  <li key={player.id} className="p-3 bg-zinc-900/70 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg">
                    {editingPlayerId === player.id ? (
                      <div className="w-full space-y-2">
                        <label className="block text-zinc-300 text-sm">Player Name:</label>
                        <input
                          type="text"
                          value={editedPlayer?.name || ""}
                          onChange={e => setEditedPlayer({ ...editedPlayer, name: e.target.value })}
                          className="w-full p-2 bg-zinc-800 text-zinc-100 rounded-lg shadow-inner"
                        />
                        <label className="block text-zinc-300 text-sm">Assign Character:</label>
                        <select
                          value={editedPlayer?.characterId || ""}
                          onChange={e => setEditedPlayer({ ...editedPlayer, characterId: e.target.value })}
                          className="w-full p-2 bg-zinc-800 text-zinc-100 rounded-lg shadow-inner"
                        >
                          <option value="">-- Unassign --</option>
                          {Object.values(characters).filter(char => char.id !== "rajinikanth").map(char => (
                            <option key={char.id} value={char.id} disabled={playersInGame.some(p => p.characterId === char.id && p.id !== player.id)}>{char.name}</option>
                          ))}
                        </select>
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={handleSavePlayer}
                            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-4 py-2 rounded-lg shadow-md"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPlayerId(null)}
                            className="bg-zinc-700 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-md"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-grow flex items-center">
                          {character?.idpic && (
                            <img
                              src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=48&h=48&fit=cover&a=top`}
                              alt={character.name}
                              className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-zinc-700"
                              onError={e => { e.target.onerror = null; e.target.src = "https://placehold.co/48x48/1a1a1a/ffffff?text=??"; }}
                            />
                          )}
                          <div>
                            <span className="font-semibold text-zinc-100">{player.name}</span>
                            <span className="block text-sm text-zinc-400">
                              {character ? `${character.name} (${character.role})` : "Character Not Assigned"}
                            </span>
                            <span className="text-xs text-zinc-500 block mt-1">User ID: {player.id}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                          <button
                            onClick={() => handleEditPlayer(player.id)}
                            className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-2 rounded-lg text-sm shadow-md"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleKickPlayer(player.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm shadow-md"
                          >
                            Kick
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === "publicBoard" && <PublicBoard />}
      {activeTab === "privateChats" && <PrivateChat />}
      {viewingClue && (
        <ClueDetailModal
          clue={viewingClue}
          isUnlocked={clueStates[viewingClue.id]?.unlocked || false}
          characters={characters}
          onClose={handleCloseClueModal}
          onToggleClue={handleToggleClue}
        />
      )}
    </div>
  );
}

export default HostDashboard;