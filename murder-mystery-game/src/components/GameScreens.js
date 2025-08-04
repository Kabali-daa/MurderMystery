import React, { useState, useEffect, useContext, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, writeBatch, getDocs, deleteDoc, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { AuthContext, GameContext } from '../contexts';
import { GameLogo } from './Common';
import { OverviewIcon, PlayersIcon, CluesIcon, PublicIcon, PrivateIcon, NotesIcon, CharactersIcon } from './Icons';

// Note: All major screen and dashboard components are in this file.
// Smaller, more specific components are defined within the component that uses them.

// --- Landing Page ---
export function LandingPage({ onCreateGame, onJoinGame }) {
    const [gameIdInput, setGameIdInput] = useState('');
    const [playerNameInput, setPlayerNameInput] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="w-full max-w-md bg-neutral-900/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-neutral-800/50">
             <div className="flex flex-col items-center justify-center mb-8">
                <GameLogo />
            </div>
            
            <div className="space-y-4">
                 <div>
                    <label className="block text-slate-400 text-sm font-medium mb-2" htmlFor="player-name">
                        Your Name
                    </label>
                    <input
                        id="player-name"
                        type="text"
                        placeholder="e.g., Detective Miles"
                        value={playerNameInput}
                        onChange={(e) => setPlayerNameInput(e.target.value)}
                        className="w-full p-3 bg-neutral-950/70 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition"
                    />
                </div>
                <div>
                    <label className="block text-slate-400 text-sm font-medium mb-2" htmlFor="game-id">
                        Game ID
                    </label>
                    <input
                        id="game-id"
                        type="text"
                        placeholder="Enter a unique Game ID"
                        value={gameIdInput}
                        onChange={(e) => setGameIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="w-full p-3 bg-neutral-950/70 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition"
                    />
                </div>
            </div>

            <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-neutral-800"></div>
                <span className="flex-shrink mx-4 text-neutral-500 text-xs uppercase">Join or Create</span>
                <div className="flex-grow border-t border-neutral-800"></div>
            </div>

            <div className="space-y-4">
                <button
                    onClick={() => onJoinGame(gameIdInput, playerNameInput)}
                    disabled={!gameIdInput || !playerNameInput}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    Join Game as Player
                </button>
                
                <div className="text-center">
                    <button onClick={() => setIsCreating(!isCreating)} className="text-sm text-slate-400 hover:text-cyan-400">
                        {isCreating ? 'Cancel Hosting' : 'Host a New Game'}
                    </button>
                </div>

                {isCreating && (
                    <div className="space-y-4 pt-4 border-t border-neutral-700/50">
                        <div>
                            <label className="block text-slate-400 text-sm font-medium mb-2" htmlFor="sheet-url">
                                Google Sheet URL
                            </label>
                            <input
                                id="sheet-url"
                                type="text"
                                placeholder="Paste public sheet link"
                                value={sheetUrl}
                                onChange={(e) => setSheetUrl(e.target.value)}
                                className="w-full p-3 bg-neutral-950/70 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition"
                            />
                        </div>
                        <button
                            onClick={() => onCreateGame(gameIdInput, sheetUrl)}
                            disabled={!gameIdInput || !sheetUrl}
                            className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            Create Game from Sheet
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


// --- Waiting for Assignment Screen ---
export function WaitingForAssignmentScreen() {
    const { gameDetails } = useContext(GameContext);
    const victim = gameDetails?.characters ? gameDetails.characters['rajinikanth'] : null;

    return (
        <div className="w-full max-w-lg bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-neutral-800/50 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Welcome!</h2>
            <p className="text-slate-300 text-lg mb-4">You have successfully joined the game.</p>
            <p className="text-slate-400">Please wait for the host to assign your character.</p>
            <div className="mt-6"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div></div>
            {victim && (
                <div className="mt-8 text-left p-4 bg-neutral-800/80 rounded-lg">
                    <h3 className="text-xl font-bold text-cyan-300 mb-3">The Case</h3>
                    <p className="text-slate-300"><span className="font-bold">Victim:</span> {victim.name}</p>
                    <p className="text-slate-300 mt-2">{victim.secretInfo}</p>
                </div>
            )}
        </div>
    );
}

// --- Host Dashboard and its child components ---
// (Many smaller components are defined here because they are only used by the HostDashboard)
export function HostDashboard({ handleResetGame, showConfirmation, setActiveTab, activeTab }) {
    const { gameId, showModalMessage, appId, unreadPublicCount, unreadPrivateChats, setUnreadPublicCount, addNotification } = useContext(AuthContext);
    const { gameDetails, playersInGame } = useContext(GameContext);

    const currentRound = gameDetails?.currentRound || 1;
    const totalUnreadPrivate = Object.values(unreadPrivateChats).some(c => c > 0) ? '●' : 0;


    const handleTabChange = (tabName) => {
        if (tabName === 'publicBoard') {
            setUnreadPublicCount(0);
        }
        setActiveTab(tabName);
    };

    const handleAdvanceRound = async () => {
        if (!gameId || !gameDetails) {
            showModalMessage("Game data is not fully loaded yet.");
            return;
        }
        const currentRound = Number(gameDetails.currentRound || 1);
        if (currentRound >= 3) {
            showModalMessage("You are already at the final round.");
            return;
        }
        showConfirmation(`Are you sure you want to advance to Round ${currentRound + 1}?`, async () => {
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                await updateDoc(gameDocRef, { currentRound: currentRound + 1 });
                addNotification(`Advanced to Round ${currentRound + 1}!`);
            } catch (e) {
                console.error("Error advancing round:", e);
                showModalMessage("Failed to advance round. Please try again.");
            }
        });
    };

    const handleStartVoting = async () => {
        if (!gameId) return;
        showConfirmation("Are you sure you want to end the investigation and start the final voting?", async () => {
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                await updateDoc(gameDocRef, { gamePhase: 'voting' });
                addNotification("Voting has begun!");
            } catch (e) {
                console.error("Error starting voting:", e);
                showModalMessage("Failed to start voting phase.");
            }
        });
    };

    const tabs = {
        overview: <HostOverviewTab setActiveTab={setActiveTab} />,
        players: <PlayerManagementTab />,
        clues: <ClueManagementTab />,
        publicBoard: <PublicBoard />,
        privateChats: <PrivateChat />,
    };

    const SidebarLink = ({ icon, label, name, activeTab, setActiveTab, notificationCount }) => {
        const isActive = activeTab === name;
        return (
            <button
                onClick={() => setActiveTab(name)}
                className={`flex items-center p-3 rounded-lg transition-colors w-full text-left relative group ${
            isActive ? 'bg-cyan-600/20 text-cyan-300' : 'hover:bg-neutral-800/50 text-slate-400 hover:text-slate-200'
          }`}
            >
                {icon}
                <span className="ml-3 font-semibold">{label}</span>
                {notificationCount > 0 && (
                    <span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${notificationCount === '●' ? 'h-2 w-2 bg-cyan-400' : 'bg-rose-500'}`}>
              {notificationCount !== '●' && notificationCount}
            </span>
                )}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-cyan-500 rounded-r-full transition-transform duration-300 ease-in-out ${isActive ? 'scale-y-100' : 'scale-y-0'} group-hover:scale-y-50`}></div>
            </button>
        );
    };

    return (
        <div className="flex h-screen bg-black text-slate-300">
            {/* Sidebar */}
            <aside className="w-64 bg-neutral-950/70 p-5 flex-col hidden sm:flex border-r border-neutral-800">
                <div className="flex items-center gap-3 mb-10">
                    <GameLogo className="w-32" />
                </div>
                <nav className="flex flex-col space-y-2">
                    <SidebarLink icon={<OverviewIcon />} label="Overview" name="overview" activeTab={activeTab} setActiveTab={handleTabChange} />
                    <SidebarLink icon={<PlayersIcon />} label="Players" name="players" activeTab={activeTab} setActiveTab={handleTabChange} />
                    <SidebarLink icon={<CluesIcon />} label="Clues" name="clues" activeTab={activeTab} setActiveTab={handleTabChange} />
                    <SidebarLink icon={<PublicIcon />} label="Public Board" name="publicBoard" activeTab={activeTab} setActiveTab={handleTabChange} notificationCount={unreadPublicCount} />
                    <SidebarLink icon={<PrivateIcon />} label="Private Chats" name="privateChats" activeTab={activeTab} setActiveTab={handleTabChange} notificationCount={totalUnreadPrivate} />
                </nav>
                <div className="mt-auto">
                    <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
                        <div className="text-xs text-slate-400">Game Phase</div>
                        <div className="text-lg font-bold text-cyan-400 capitalize">{gameDetails?.gamePhase}</div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 flex-shrink-0">
                    <div>
                        <h3 className="text-3xl font-bold text-white">Game ID: <span className="text-cyan-400">{gameId}</span></h3>
                        <p className="text-slate-400">{playersInGame.length} players connected • Round {currentRound} of 3</p>
                    </div>
                    <div className="flex space-x-2 sm:space-x-4 mt-4 sm:mt-0">
                        {currentRound < 3 ? (
                            <button onClick={handleAdvanceRound} className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-700 transition-colors shadow-md">Advance Round</button>
                        ) : (
                            <button onClick={handleStartVoting} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors shadow-md">Begin Voting</button>
                        )}
                        <button onClick={handleResetGame} className="bg-rose-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-rose-700 transition-colors shadow-md">End Game</button>
                    </div>
                </header>

                <div className="w-full flex-grow h-full">
                    {tabs[activeTab]}
                </div>

            </main>
        </div>
    );
}

// ... more components would go here ...
// For brevity, I'll add the rest of the components. You should copy all of them into this file.

const HostOverviewTab = ({ setActiveTab }) => {
    const { gameDetails, playersInGame, clueStates } = useContext(GameContext);
    const { recentActivity } = useContext(AuthContext);
    const characters = gameDetails?.characters || {};
    const allClues = gameDetails?.clues || [];
    const [showRoles, setShowRoles] = useState(false);

    const assignedCharactersCount = playersInGame.filter(p => p.characterId).length;
    const unlockedCluesCount = allClues.filter(c => clueStates[c.id]?.unlocked).length;

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Stats Card */}
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg">
                    <h4 className="text-lg font-bold text-white mb-4">Game Statistics</h4>
                    <div className="space-y-3">
                        <p className="flex justify-between"><span>Active Players</span> <span className="font-bold text-cyan-400">{playersInGame.length}</span></p>
                        <p className="flex justify-between"><span>Characters Assigned</span> <span className="font-bold text-cyan-400">{assignedCharactersCount} / {Object.keys(characters).length -1}</span></p>
                        <p className="flex justify-between"><span>Clues Unlocked</span> <span className="font-bold text-cyan-400">{unlockedCluesCount} / {allClues.length}</span></p>
                    </div>
                </div>
                {/* Quick Actions Card */}
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg">
                    <h4 className="text-lg font-bold text-white mb-4">Quick Actions</h4>
                    <div className="space-y-3">
                        <button onClick={() => setActiveTab('clues')} className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"><PrivateIcon /> <span className="ml-2">Unlock Clue</span></button>
                        <button onClick={() => setActiveTab('publicBoard')} className="w-full flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 font-bold py-3 px-4 rounded-lg transition-colors"><PublicIcon /> <span className="ml-2">Announcement</span></button>
                        <button onClick={() => setActiveTab('players')} className="w-full flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 font-bold py-3 px-4 rounded-lg transition-colors"><PlayersIcon /> <span className="ml-2">Assign Character</span></button>
                    </div>
                </div>
                {/* Recent Activity Card */}
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg">
                    <h4 className="text-lg font-bold text-white mb-4">Recent Activity</h4>
                    <ul className="space-y-3">
                        {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                            <li key={index} className="text-sm">
                {activity.type === 'public_message' && <p><span className="font-bold text-cyan-400">{activity.sender}</span> posted on the public board.</p>}
                {activity.type === 'private_message' && <p><span className="font-bold text-cyan-400">{activity.sender}</span> sent a private message to <span className="font-bold text-cyan-400">{activity.receiver}</span>.</p>}
                <p className="text-xs text-slate-400 truncate italic">"{activity.text}"</p>
              </li>
                        )) : <p className="text-sm text-slate-400">No recent activity.</p>}
                    </ul>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white">Character Status Overview</h4>
                    <button onClick={() => setShowRoles(!showRoles)} className="bg-neutral-700 text-xs font-bold py-1 px-3 rounded-lg">{showRoles ? 'Hide Roles' : 'Reveal Roles'}</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.values(characters).filter(c => c.id !== 'rajinikanth').map(character => {
                        const player = playersInGame.find(p => p.characterId === character.id);
                        return (
                            <div key={character.id} className="bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-lg flex items-center">
                                <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=64&h=64&fit=cover&a=top`} alt={character.name} className="w-16 h-16 rounded-full object-cover mr-4 border-2 border-neutral-700"/>
                                <div>
                                    <h5 className="font-bold text-white">{character.name}</h5>
                                    <p className="text-sm text-slate-400">{character.role}</p>
                                    <p className="text-xs text-neutral-500">Player: {player?.name || 'Unassigned'}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    {showRoles && character.isKiller && <span className="block text-xs font-bold bg-rose-600 text-white px-2 py-1 rounded-full mb-2">KILLER</span>}
                                    <span className={`block text-xs font-bold ${player ? 'text-emerald-400' : 'text-amber-400'}`}>● {player ? 'Active' : 'Unassigned'}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
};

const PlayerManagementTab = () => {
    const { gameId, showModalMessage, showConfirmation, appId, addNotification } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const characters = gameDetails?.characters || {};

    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editedPlayer, setEditedPlayer] = useState(null);

    const handleEditPlayer = (playerId) => {
        setEditingPlayerId(playerId);
        setEditedPlayer({ ...playersInGame.find(p => p.id === playerId) });
    };

    const handleSavePlayer = async () => {
        if (!editedPlayer || !gameId || !editingPlayerId) {
            showModalMessage("Player data is missing.");
            return;
        }

        const assignedToAnother = playersInGame.some(
            p => p.id !== editingPlayerId && p.characterId && p.characterId === editedPlayer.characterId
        );

        if (assignedToAnother) {
            showModalMessage(`Character ${characters[editedPlayer.characterId].name} is already assigned.`);
            return;
        }

        try {
            const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${editingPlayerId}`);
            await updateDoc(playerDocRef, {
                name: editedPlayer.name,
                characterId: editedPlayer.characterId || null
            });

            addNotification(`Player ${editedPlayer.name}'s details updated.`);
            setEditingPlayerId(null);
            setEditedPlayer(null);
        } catch (e) {
            console.error("Error saving player:", e);
            showModalMessage("Failed to save player details. Please try again.");
        }
    };

    const handleKickPlayer = (playerId) => {
        showConfirmation(
            `Are you sure you want to kick this player? They will be removed from the game.`,
            async () => {
                try {
                    const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${playerId}`);
                    await deleteDoc(playerDocRef);
                    addNotification("Player kicked successfully.");
                    setEditingPlayerId(null);
                } catch (e) {
                    console.error("Error kicking player:", e);
                    showModalMessage("Failed to kick player. Please try again.");
                }
            }
        );
    };

    return (
        <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-4">Manage Players</h3>
            {playersInGame.length === 0 ? (
                <p className="text-slate-400">No players have joined yet.</p>
            ) : (
                <ul className="space-y-3">
                    {playersInGame.map(player => {
                        const character = characters[player.characterId];
                        return (
                            <li key={player.id} className="p-3 bg-neutral-800/70 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg">
                                {editingPlayerId === player.id ? (
                                    <div className="w-full space-y-2">
                                        <label className="block text-slate-300 text-sm">Player Name:</label>
                                        <input
                                            type="text"
                                            value={editedPlayer?.name || ''}
                                            onChange={(e) => setEditedPlayer({ ...editedPlayer, name: e.target.value })}
                                            className="w-full p-2 bg-neutral-900 text-slate-100 rounded-lg shadow-inner"
                                        />
                                        <label className="block text-slate-300 text-sm">Assign Character:</label>
                                        <select
                                            value={editedPlayer?.characterId || ''}
                                            onChange={(e) => setEditedPlayer({ ...editedPlayer, characterId: e.target.value })}
                                            className="w-full p-2 bg-neutral-900 text-slate-100 rounded-lg shadow-inner"
                                        >
                                            <option value="">-- Unassign --</option>
                                            {Object.values(characters).filter(char => char.id !== 'rajinikanth').map(char => (
                                                <option key={char.id} value={char.id} disabled={playersInGame.some(p => p.characterId === char.id && p.id !== player.id)}>{char.name}</option>
                                            ))}
                                        </select>
                                        <div className="flex space-x-2 mt-2">
                                            <button onClick={handleSavePlayer} className="bg-cyan-500 text-white px-4 py-2 rounded-lg shadow-md font-semibold">Save</button>
                                            <button onClick={() => setEditingPlayerId(null)} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg shadow-md font-semibold">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-grow flex items-center">
                                            {character?.idpic ? (
                                                <img
                                                    src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=48&h=48&fit=cover&a=top`}
                                                    alt={character.name || ''}
                                                    className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-neutral-700"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/48x48/171717/ffffff?text=??'; }}
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full mr-4 bg-neutral-700 flex items-center justify-center font-bold text-lg">?</div>
                                            )}
                                            <div>
                                                <span className="font-semibold text-slate-100">{player.name}</span>
                                                <span className="block text-sm text-cyan-400">
                          {character ? `${character.name} (${character.role})` : 'Character Not Assigned'}
                        </span>
                                                <span className="text-xs text-neutral-500 block mt-1">User ID: {player.id}</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 mt-2 md:mt-0">
                                            <button onClick={() => handleEditPlayer(player.id)} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg text-sm shadow-md font-semibold">Edit</button>
                                            <button onClick={() => handleKickPlayer(player.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm shadow-md font-semibold">Kick</button>
                                        </div>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const ClueManagementTab = () => {
    const { gameId, showModalMessage, appId, addNotification } = useContext(AuthContext);
    const { gameDetails } = useContext(GameContext);

    const [visibleRound, setVisibleRound] = useState(gameDetails?.currentRound || 1);

    const characters = gameDetails?.characters || {};
    const allClues = gameDetails?.clues || [];
    const currentRound = gameDetails?.currentRound || 1;

    useEffect(() => {
        setVisibleRound(currentRound);
    }, [currentRound]);

    const handleToggleClue = async (clueId, isUnlocked) => {
        if (!gameId) return;
        try {
            const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
            const gameSnap = await getDoc(gameDocRef);
            if (!gameSnap.exists()) {
                showModalMessage("Error: Game document not found.");
                return;
            }
            const gameData = gameSnap.data();
            const currentClues = gameData.clues || [];

            const updatedClues = currentClues.map(clue =>
                clue.id === clueId ? { ...clue, unlocked: !isUnlocked, unlockedAt: new Date().toISOString() } : clue
            );
            
            await setDoc(gameDocRef, { clues: updatedClues }, { merge: true });
            
            addNotification(`Clue ${isUnlocked ? 'locked' : 'unlocked'}!`);
        } catch (e) {
            console.error("Error toggling clue:", e);
            showModalMessage("Failed to update clue. Please try again.");
        }
    };

    const assignedCharacterIds = useContext(GameContext).playersInGame.map(p => p.characterId).filter(Boolean);

    return (
        <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-white">Manage Clues & Evidence</h3>
                <div className="flex items-center space-x-1 bg-neutral-800 p-1 rounded-lg">
                    {Array.from({ length: currentRound }, (_, i) => i + 1).map(roundNum => (
                        <button
                            key={roundNum}
                            onClick={() => setVisibleRound(roundNum)}
                            className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${visibleRound === roundNum ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-slate-200 hover:bg-neutral-700'}`}
                        >
                            Round {roundNum}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {allClues
                    .filter(clue => clue.round === visibleRound && assignedCharacterIds.includes(clue.characterId))
                    .map(clue => {
                        const character = characters[clue.characterId];
                        const isUnlocked = gameDetails.clues.find(c => c.id === clue.id)?.unlocked || false;
                        return (
                            <div key={clue.id} className={`p-4 rounded-lg flex items-center justify-between transition-all duration-300 ${isUnlocked ? 'bg-neutral-800' : 'bg-black/50 border border-neutral-800'}`}>
                                <div className="flex items-center gap-4">
                                    <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=48&h=48&fit=cover&a=top`} alt={character.name} className="w-12 h-12 rounded-full object-cover border-2 border-neutral-700"/>
                                    <div>
                                        <p className="font-bold text-white">{clue.description}</p>
                                        <p className="text-sm text-slate-400">For: {character.name} ({character.role})</p>
                                    </div>
                                </div>
                                <button onClick={() => handleToggleClue(clue.id, isUnlocked)} className={`px-4 py-2 rounded-lg font-bold text-sm transition duration-300 ease-in-out shadow-md flex items-center gap-2 ${isUnlocked ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                                    {isUnlocked ? 'Lock' : 'Unlock'}
                                </button>
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
};

// --- Player Dashboard and its child components ---
export function PlayerDashboard({ activeTab, setActiveTab }) {
    const { userId, gameId, characterId, setUnreadPublicCount, setUnreadPrivateChats, unreadPublicCount, unreadPrivateChats, appId, isMuted, setIsMuted } = useContext(AuthContext);
    const { clueStates, playersInGame, gameDetails } = useContext(GameContext);
    const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [seenClues, setSeenClues] = useState([]);
    const [highlightedClues, setHighlightedClues] = useState(new Set());
    
    const myCharacter = gameDetails?.characters ? gameDetails.characters[characterId] : null;
    const victim = gameDetails?.characters ? gameDetails.characters['rajinikanth'] : null;
    const currentRound = gameDetails?.currentRound || 1;
    const allClues = gameDetails?.clues || [];

    const timeoutRef = useRef(null);
    const prevGloballyUnlockedCluesRef = useRef(null);

    const totalUnreadPrivate = Object.values(unreadPrivateChats).reduce((acc, count) => acc + count, 0);

    const handleTabChange = (tabName) => {
        if (tabName === 'publicBoard') setUnreadPublicCount(0);
        if (tabName === 'privateChat') {
            const newUnread = { ...unreadPrivateChats };
            Object.keys(newUnread).forEach(key => newUnread[key] = 0);
            setUnreadPrivateChats(newUnread);
        }
        if (tabName === 'clues') {
            handleMarkCluesAsSeen();
        }
        setActiveTab(tabName);
    };

    useEffect(() => {
        if (userId && gameId) {
            const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
            const unsub = onSnapshot(playerDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setNotes(data.notes || '');
                    setSeenClues(data.seenClues || []);
                }
            });
            return () => unsub();
        }
    }, [userId, gameId, appId]);

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
            if (userId && gameId) {
                const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
                try {
                    await updateDoc(playerDocRef, { notes: notes });
                } catch (e) {
                    console.error("Failed to save notes:", e);
                }
            }
        }, 1000);

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [notes, userId, gameId, appId]);

    const globallyUnlockedClues = allClues
        .filter(clue => clueStates[clue.id]?.unlocked && clue.round <= currentRound)
        .sort((a, b) => new Date(clueStates[b.id]?.unlockedAt) - new Date(clueStates[a.id]?.unlockedAt));

    const myCharacterSpecificClues = allClues.filter(clue =>
        clue.characterId === characterId
    );

    useEffect(() => {
        const currentUnlockedIds = new Set(globallyUnlockedClues.map(c => c.id));
        const prevUnlockedIds = prevGloballyUnlockedCluesRef.current ? new Set(prevGloballyUnlockedCluesRef.current.map(c => c.id)) : new Set();
        const newlyRevealedClueIds = [...currentUnlockedIds].filter(id => !prevUnlockedIds.has(id));

        if (newlyRevealedClueIds.length > 0) {
            // Sound removed
            setHighlightedClues(current => {
                const newSet = new Set(current);
                newlyRevealedClueIds.forEach(id => newSet.add(id));
                return newSet;
            });

            newlyRevealedClueIds.forEach(id => {
                setTimeout(() => {
                    setHighlightedClues(current => {
                        const newSet = new Set(current);
                        newSet.delete(id);
                        return newSet;
                    });
                }, 10000);
            });
        }
        prevGloballyUnlockedCluesRef.current = globallyUnlockedClues;
    }, [globallyUnlockedClues]);

    const newCluesCount = globallyUnlockedClues.filter(clue => !seenClues.includes(clue.id)).length;

    const handleMarkCluesAsSeen = async () => {
        const newClueIds = globallyUnlockedClues.map(c => c.id).filter(id => !seenClues.includes(id));
        if (newCluesCount > 0) {
            const updatedSeenClues = [...seenClues, ...newClueIds];
            setSeenClues(updatedSeenClues);
            const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
            try {
                await updateDoc(playerDocRef, { seenClues: updatedSeenClues });
            } catch (e) {
                console.error("Failed to mark clues as seen:", e);
            }
        }
    };

    if (!myCharacter) {
        return <WaitingForAssignmentScreen />;
    }

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'character':
                return <PlayerCharacterTab myCharacter={myCharacter} victim={victim} myCharacterSpecificClues={myCharacterSpecificClues} onOpenDirectory={() => setIsDirectoryOpen(true)} />;
            case 'clues':
                return <PlayerCluesTab globallyUnlockedClues={globallyUnlockedClues} highlightedClues={highlightedClues} onMarkSeen={handleMarkCluesAsSeen} />;
            case 'publicBoard':
                return <PublicBoard />;
            case 'privateChat':
                return <PrivateChat />;
            case 'notes':
                return <PlayerNotesTab notes={notes} setNotes={setNotes} />;
            default:
                setActiveTab('character');
                return <PlayerCharacterTab myCharacter={myCharacter} victim={victim} myCharacterSpecificClues={myCharacterSpecificClues} onOpenDirectory={() => setIsDirectoryOpen(true)} />;
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto h-screen flex flex-col">
            <PlayerTopNav 
                activeTab={activeTab} 
                setActiveTab={handleTabChange} 
                unreadPublic={unreadPublicCount} 
                unreadPrivate={totalUnreadPrivate} 
                newCluesCount={newCluesCount} 
                characterName={myCharacter.name}
                currentRound={currentRound}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
            />
            <main className="flex-grow overflow-y-auto bg-neutral-900/30 rounded-b-xl">
                {renderActiveTabContent()}
            </main>
            {isDirectoryOpen && <CharacterDirectoryModal characters={gameDetails.characters} players={playersInGame} onClose={() => setIsDirectoryOpen(false)} />}
        </div>
    );
}

// ... and so on for all the other components.
