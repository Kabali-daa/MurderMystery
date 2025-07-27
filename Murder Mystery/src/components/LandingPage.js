import React, { useState } from "react";

const LandingPage = ({ onCreateGame, onJoinGame }) => {
  const [gameIdInput, setGameIdInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");

  return (
    <div className="w-full max-w-md bg-black/50 backdrop-blur-md p-4 sm:p-8 rounded-xl shadow-lg border border-zinc-700/50">
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-center mb-4 sm:mb-6 text-red-500">Start or Join Game</h2>
      <div className="mb-4">
        <label className="block text-zinc-300 text-sm font-bold mb-2" htmlFor="player-name">
          Your Name
        </label>
        <input
          id="player-name"
          type="text"
          placeholder="Enter your name"
          value={playerNameInput}
          onChange={e => setPlayerNameInput(e.target.value)}
          className="w-full p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
        />
      </div>
      <div className="mb-6">
        <label className="block text-zinc-300 text-sm font-bold mb-2" htmlFor="game-id">
          Game ID
        </label>
        <input
          id="game-id"
          type="text"
          placeholder="Enter Game ID to create or join"
          value={gameIdInput}
          onChange={e => setGameIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className="w-full p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
        />
      </div>
      <div className="border-t border-zinc-700 my-6"></div>
      <div>
        <h3 className="text-lg sm:text-xl font-playfair-display font-bold text-center text-red-400 mb-4">Host a New Game</h3>
        <div className="mb-4">
          <label className="block text-zinc-300 text-sm font-bold mb-2" htmlFor="sheet-url">
            Google Sheet URL
          </label>
          <input
            id="sheet-url"
            type="text"
            placeholder="Paste your Google Sheet link here"
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            className="w-full p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
          />
        </div>
        <button
          onClick={() => onCreateGame(gameIdInput, sheetUrl)}
          disabled={!gameIdInput || !sheetUrl}
          className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-2 sm:py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create New Game from Sheet
        </button>
      </div>
      <div className="text-center text-zinc-400 my-4">— OR —</div>
      <div>
        <h3 className="text-lg sm:text-xl font-playfair-display font-bold text-center text-red-400 mb-4">Join as a Player</h3>
        <button
          onClick={() => onJoinGame(gameIdInput, playerNameInput)}
          disabled={!gameIdInput || !playerNameInput}
          className="w-full bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-2 sm:py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join Game
        </button>
      </div>
    </div>
  );
};

export default LandingPage;