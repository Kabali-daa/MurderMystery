import React, { useState, useEffect, useRef, useContext } from "react";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import PublicBoard from "./PublicBoard";
import PrivateChat from "./PrivateChat";
import CharacterDirectoryModal from "./CharacterDirectoryModal";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function PlayerDashboard({ gameDetails, setActiveTab, activeTab }) {
  const {
    userId,
    gameId,
    characterId,
    setUnreadPublicCount,
    setUnreadPrivateChats,
    unreadPublicCount,
    unreadPrivateChats,
  } = useContext(AuthContext);
  const { clueStates, playersInGame } = useContext(GameContext);

  const [isVictimDossierOpen, setIsVictimDossierOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [seenClues, setSeenClues] = useState([]);
  const [highlightedClues, setHighlightedClues] = useState(new Set());

  const myCharacter = gameDetails?.characters ? gameDetails.characters[characterId] : null;
  const victim = gameDetails?.characters ? gameDetails.characters["rajinikanth"] : null;
  const currentRound = gameDetails?.currentRound || 1;
  const allClues = gameDetails?.clues || [];

  const timeoutRef = useRef(null);
  const prevGloballyUnlockedCluesRef = useRef([]);

  const totalUnreadPrivate = Object.values(unreadPrivateChats).reduce((acc, count) => acc + count, 0);

  const handleTabChange = (tabName) => {
    if (tabName === "publicBoard") setUnreadPublicCount(0);
    if (tabName === "privateChat") setUnreadPrivateChats({});
    setActiveTab(tabName);
  };

  // Fetch initial notes and seen clues
  useEffect(() => {
    if (userId && gameId) {
      const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${userId}`);
      const unsub = onSnapshot(playerDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNotes(data.notes || "");
          setSeenClues(data.seenClues || []);
        }
      });
      return () => unsub();
    }
  }, [userId, gameId]);

  // Debounced save for notes
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (userId && gameId) {
        const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${userId}`);
        try {
          await updateDoc(playerDocRef, { notes: notes });
        } catch (e) {
          // ignore for now
        }
      }
    }, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [notes, userId, gameId]);

  const globallyUnlockedClues = allClues
    .filter((clue) => !clue.recipientCharacterId && clueStates[clue.id]?.unlocked && clue.round <= currentRound)
    .sort((a, b) => new Date(clueStates[b.id]?.unlockedAt) - new Date(clueStates[a.id]?.unlockedAt));

  const myCharacterSpecificClues = allClues.filter(
    (clue) => clue.characterId === characterId || clue.source === characterId
  );

  // Effect to handle the "NEW" badge timeout
  useEffect(() => {
    const currentUnlockedIds = new Set(globallyUnlockedClues.map((c) => c.id));
    const prevUnlockedIds = new Set(prevGloballyUnlockedCluesRef.current.map((c) => c.id));
    const newlyRevealedClueIds = [...currentUnlockedIds].filter((id) => !prevUnlockedIds.has(id));

    if (newlyRevealedClueIds.length > 0) {
      setHighlightedClues((current) => {
        const newSet = new Set(current);
        newlyRevealedClueIds.forEach((id) => newSet.add(id));
        return newSet;
      });

      newlyRevealedClueIds.forEach((id) => {
        setTimeout(() => {
          setHighlightedClues((current) => {
            const newSet = new Set(current);
            newSet.delete(id);
            return newSet;
          });
        }, 10000);
      });
    }
    prevGloballyUnlockedCluesRef.current = globallyUnlockedClues;
  }, [globallyUnlockedClues]);

  if (!myCharacter) {
    return (
      <div className="text-center text-xl text-zinc-400">
        You are not assigned a character yet or your character data is loading.
      </div>
    );
  }

  const handleMarkCluesAsSeen = async () => {
    const newClueIds = globallyUnlockedClues.map((c) => c.id).filter((id) => !seenClues.includes(id));
    if (newClueIds.length > 0) {
      const updatedSeenClues = [...seenClues, ...newClueIds];
      setSeenClues(updatedSeenClues);
      setHighlightedClues((current) => {
        const newSet = new Set(current);
        newClueIds.forEach((id) => newSet.delete(id));
        return newSet;
      });
      const playerDocRef = doc(db, `artifacts/default-app-id/public/data/games/${gameId}/players/${userId}`);
      try {
        await updateDoc(playerDocRef, { seenClues: updatedSeenClues });
      } catch (e) {
        // ignore
      }
    }
  };

  const renderClueContent = (clue) => {
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
        if (clue.type === "image") {
          return (
            <img
              src={`https://drive.google.com/uc?export=view&id=${fileId}`}
              alt={clue.description}
              className="mt-2 rounded-md max-w-full h-auto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://placehold.co/300x200/000000/FFFFFF?text=Image+Error";
              }}
            />
          );
        }
        if (clue.type === "audio") {
          return (
            <audio
              controls
              src={`https://drive.google.com/uc?export=media&id=${fileId}`}
              className="mt-2 w-full"
            ></audio>
          );
        }
      }

      switch (clue.type) {
        case "image":
          const proxiedImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
          return (
            <img
              src={proxiedImageUrl}
              alt={clue.description}
              className="mt-2 rounded-md max-w-full h-auto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://placehold.co/300x200/000000/FFFFFF?text=Image+Error";
              }}
            />
          );
        case "audio":
          return <audio controls src={firstUrl} className="mt-2 w-full"></audio>;
        case "video":
          return <video controls src={firstUrl} className="mt-2 w-full"></video>;
        default:
          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(firstUrl)) {
            const defaultProxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
            return (
              <img
                src={defaultProxiedUrl}
                alt={clue.description}
                className="mt-2 rounded-md max-w-full h-auto"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://placehold.co/300x200/000000/FFFFFF?text=Image+Error";
                }}
              />
            );
          }
          return (
            <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
              {firstUrl}
            </a>
          );
      }
    };

    return (
      <>
        {mediaElement()}
        {textContent && <p className="text-zinc-300 mt-2">{textContent}</p>}
      </>
    );
  };

  return (
    <div className="w-full lg:max-w-3xl bg-black/50 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-lg border border-zinc-700/50">
      {myCharacter.idpic && (
        <img
          src={`https://images.weserv.nl/?url=${encodeURIComponent(myCharacter.idpic)}&w=128&h=128&fit=cover&a=top`}
          alt={myCharacter.name}
          className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-red-700 shadow-lg"
        />
      )}
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-center mb-2 text-red-500">
        {myCharacter.name}
      </h2>
      <p className="text-lg text-zinc-300 mb-2 text-center">Role: {myCharacter.role}</p>
      <p className="text-lg text-zinc-300 mb-6 text-center">
        Current Round: <span className="font-bold text-red-500">{currentRound}</span>
      </p>
      <div className="flex flex-wrap justify-center border-b border-red-800/50 mb-6">
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${
            activeTab === "character" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"
          }`}
          onClick={() => handleTabChange("character")}
        >
          Character
        </button>
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${
            activeTab === "clues" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"
          }`}
          onClick={() => handleTabChange("clues")}
        >
          Clues
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${
            activeTab === "publicBoard" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"
          }`}
          onClick={() => handleTabChange("publicBoard")}
        >
          Public
          {unreadPublicCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unreadPublicCount}
            </span>
          )}
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${
            activeTab === "privateChat" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"
          }`}
          onClick={() => handleTabChange("privateChat")}
        >
          Private
          {totalUnreadPrivate > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {totalUnreadPrivate}
            </span>
          )}
        </button>
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${
            activeTab === "notes" ? "bg-red-900/50 text-red-300" : "text-zinc-400 hover:text-zinc-100"
          }`}
          onClick={() => handleTabChange("notes")}
        >
          Notes
        </button>
      </div>

      {activeTab === "character" && (
        <div className="bg-zinc-800/80 p-4 rounded-lg mb-6 shadow-lg">
          <h3 className="text-xl font-playfair-display font-bold text-red-400 mb-3">Your Character Details</h3>
          <p className="text-zinc-300 mt-2">
            <span className="font-bold text-zinc-100">How to Act Your Part:</span> {myCharacter.howtoactyourpart || "No specific instructions provided."}
          </p>
          <p className="text-zinc-300 mt-2">
            <span className="font-bold text-zinc-100">Suggested Costume:</span> {myCharacter.suggestedCostume || "Not specified"}
          </p>
          <p className="text-zinc-300 mt-2">
            <span className="font-bold text-zinc-100">Secret Information (DO NOT SHARE):</span> {myCharacter.secretInfo}
          </p>
          <p className="text-zinc-300 mt-2">
            <span className="font-bold text-zinc-100">Motive:</span> {myCharacter.motive}
          </p>
          <h4 className="text-lg font-bold text-red-300 mt-4">Your Character's Clues</h4>
          {myCharacterSpecificClues.length === 0 ? (
            <p className="text-zinc-400 italic">No specific clues assigned to your character.</p>
          ) : (
            <ul className="list-disc list-inside text-zinc-300 mt-2">
              {myCharacterSpecificClues.map((clue) => (
                <li key={clue.id} className="mb-1">
                  <span className="font-semibold">{clue.description}:</span> {clue.content}
                </li>
              ))}
            </ul>
          )}
          {myCharacter.isKiller && (
            <div className="bg-red-900 bg-opacity-50 shadow-lg p-4 rounded-lg mt-6 text-center">
              <p className="text-xl font-bold text-red-300">YOU ARE THE KILLER!</p>
              <p className="text-red-200 mt-2">Your secret is safe. Blend in, deceive, and avoid suspicion.</p>
            </div>
          )}

          <div className="bg-zinc-800/80 rounded-lg my-6 shadow-lg overflow-hidden">
            <button
              onClick={() => setIsVictimDossierOpen(!isVictimDossierOpen)}
              className="w-full p-4 text-left text-xl font-playfair-display font-bold text-red-400 flex justify-between items-center hover:bg-zinc-700/50 transition-colors"
            >
              <span>Victim Dossier</span>
              <span>{isVictimDossierOpen ? "−" : "+"}</span>
            </button>
            {isVictimDossierOpen && victim && (
              <div className="p-4 border-t border-zinc-700">
                <h4 className="text-lg font-bold text-zinc-100 mb-2">The Victim: {victim.name}</h4>
                <p className="text-zinc-300">{victim.secretInfo}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsDirectoryOpen(true)}
            className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
          >
            View Cast of Characters
          </button>
        </div>
      )}

      {activeTab === "clues" && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-playfair-display font-bold text-red-500">Globally Unlocked Clues</h3>
            <button onClick={handleMarkCluesAsSeen} className="bg-red-800 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700">
              Mark All as Seen
            </button>
          </div>
          {globallyUnlockedClues.length === 0 ? (
            <p className="text-zinc-400">No clues unlocked yet. Wait for the host to reveal them!</p>
          ) : (
            <ul className="space-y-4">
              {globallyUnlockedClues.map((clue) => {
                const character = gameDetails.characters[clue.characterId];
                const isNew = highlightedClues.has(clue.id);
                return (
                  <li
                    key={clue.id}
                    className={`bg-zinc-800/80 p-4 rounded-lg shadow-lg relative overflow-hidden ${
                      isNew ? "border-2 border-yellow-400" : ""
                    }`}
                  >
                    {isNew && (
                      <span className="absolute top-0 right-0 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">
                        NEW
                      </span>
                    )}
                    <p className="font-bold text-zinc-100 text-lg mb-1">
                      {clue.description}
                      <span className="text-sm text-zinc-400 font-normal">
                        (Regarding: {character ? `${character.name} - ${character.role}` : "Unknown"})
                      </span>
                    </p>
                    <p className="text-sm text-zinc-400 italic">
                      Round {clue.round} | Type: {clue.type}
                    </p>
                    {renderClueContent(clue)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === "publicBoard" && <PublicBoard />}
      {activeTab === "privateChat" && <PrivateChat />}
      {activeTab === "notes" && (
        <div>
          <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">My Private Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down your suspicions, theories, and important details here..."
            className="w-full h-64 p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
          />
        </div>
      )}
      {isDirectoryOpen && (
        <CharacterDirectoryModal
          characters={gameDetails.characters}
          players={playersInGame}
          onClose={() => setIsDirectoryOpen(false)}
        />
      )}
    </div>
  );
}

export default PlayerDashboard;