import React, { useState, useEffect, useContext, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, writeBatch, getDocs, deleteDoc, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { AuthContext, GameContext } from '../contexts';
import { GameLogo } from './Common';
import { OverviewIcon, PlayersIcon, CluesIcon, PublicIcon, PrivateIcon, NotesIcon, CharactersIcon } from './icons';

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
    
    const HostMobileNav = () => {
        const navItems = [
            { name: 'overview', label: 'Overview', icon: <OverviewIcon /> },
            { name: 'players', label: 'Players', icon: <PlayersIcon /> },
            { name: 'clues', label: 'Clues', icon: <CluesIcon /> },
            { name: 'publicBoard', label: 'Public', icon: <PublicIcon /> },
            { name: 'privateChats', label: 'Private', icon: <PrivateIcon /> },
        ];

        return (
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-neutral-900/80 backdrop-blur-lg border-t border-neutral-800 flex justify-around p-1 z-50">
                {navItems.map(item => (
                     <button key={item.name} onClick={() => handleTabChange(item.name)} className={`flex flex-col items-center justify-center w-full h-full relative transition-colors py-2 rounded-lg group ${activeTab === item.name ? 'text-cyan-400' : 'text-slate-400 hover:bg-neutral-700/50 hover:text-slate-200'}`}>
                        {item.icon}
                        <span className="text-xs mt-1 font-semibold">{item.label}</span>
                     </button>
                ))}
            </nav>
        );
    };

    return (
        <div className="flex h-screen w-full bg-black text-slate-300">
            {/* Sidebar for Desktop */}
            <aside className="w-64 bg-neutral-950/70 p-5 flex-col hidden sm:flex border-r border-neutral-800 flex-shrink-0">
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
            <main className="flex-1 flex flex-col w-full overflow-y-auto pb-20 sm:pb-0">
                <div className="w-full max-w-7xl mx-auto p-4 sm:p-8">
                    <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 flex-shrink-0">
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-white">Game ID: <span className="text-cyan-400">{gameId}</span></h3>
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
                </div>
            </main>
            <HostMobileNav />
        </div>
    );
}



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
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg flex flex-col">
                    <h4 className="text-lg font-bold text-white mb-4">Game Statistics</h4>
                    <div className="space-y-3 flex-grow">
                        <p className="flex justify-between"><span>Active Players</span> <span className="font-bold text-cyan-400">{playersInGame.length}</span></p>
                        <p className="flex justify-between"><span>Characters Assigned</span> <span className="font-bold text-cyan-400">{assignedCharactersCount} / {Object.keys(characters).length -1}</span></p>
                        <p className="flex justify-between"><span>Clues Unlocked</span> <span className="font-bold text-cyan-400">{unlockedCluesCount} / {allClues.length}</span></p>
                    </div>
                </div>
                {/* Quick Actions Card */}
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg flex flex-col">
                    <h4 className="text-lg font-bold text-white mb-4">Quick Actions</h4>
                    <div className="space-y-3 flex-grow flex flex-col justify-center">
                        <button onClick={() => setActiveTab('clues')} className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"><CluesIcon /> <span className="ml-2">Unlock Clue</span></button>
                        <button onClick={() => setActiveTab('publicBoard')} className="w-full flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 font-bold py-3 px-4 rounded-lg transition-colors"><PublicIcon /> <span className="ml-2">Announcement</span></button>
                        <button onClick={() => setActiveTab('players')} className="w-full flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 font-bold py-3 px-4 rounded-lg transition-colors"><PlayersIcon /> <span className="ml-2">Assign Character</span></button>
                    </div>
                </div>
                {/* Recent Activity Card */}
                <div className="bg-neutral-900/50 border border-neutral-800/80 p-6 rounded-lg flex flex-col">
                    <h4 className="text-lg font-bold text-white mb-4">Recent Activity</h4>
                    <ul className="space-y-3 flex-grow">
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
                    const batch = writeBatch(db);

                    // Delete player from the game's player list
                    const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${playerId}`);
                    batch.delete(playerDocRef);

                    // Reset the kicked player's user profile so they can join another game
                    const userProfileRef = doc(db, `artifacts/${appId}/users/${playerId}/profile/data`);
                    batch.update(userProfileRef, { gameId: null, characterId: null, isHost: false });
                    
                    await batch.commit();

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
        <div className="w-full max-w-4xl mx-auto h-screen flex flex-col p-2 sm:p-0">
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

const MuteButton = ({ isMuted, setIsMuted }) => {
    return (
        <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white">
            {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15v1a1 1 0 001 1h12a1 1 0 001-1v-1a1 1 0 00-.293-.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
            )}
        </button>
    );
};

const PlayerTopNav = ({ activeTab, setActiveTab, unreadPublic, unreadPrivate, newCluesCount, characterName, currentRound, isMuted, setIsMuted }) => {
    const navItems = [
        { name: 'character', label: 'Character', icon: <CharactersIcon />, count: 0 },
        { name: 'clues', label: 'Clues', icon: <CluesIcon />, count: newCluesCount },
        { name: 'publicBoard', label: 'Public', icon: <PublicIcon />, count: unreadPublic },
        { name: 'privateChat', label: 'Private', icon: <PrivateIcon />, count: unreadPrivate },
        { name: 'notes', label: 'Notes', icon: <NotesIcon />, count: 0 },
    ];

    return (
        <header className="bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-800 sticky top-0 z-20 p-2 rounded-t-xl">
            <div className="flex justify-between items-center mb-2 px-2">
                 <h1 className="text-xl font-bold text-white">{characterName}</h1>
                 <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-400 bg-neutral-800 px-3 py-1 rounded-full">Round {currentRound}</div>
                    <MuteButton isMuted={isMuted} setIsMuted={setIsMuted} />
                 </div>
            </div>
            <nav className="flex justify-around items-center bg-neutral-800/50 p-1 rounded-lg">
                {navItems.map(item => (
                    <button key={item.name} onClick={() => setActiveTab(item.name)} className={`flex flex-col items-center justify-center w-full h-full relative transition-colors py-2 rounded-lg group ${activeTab === item.name ? 'text-cyan-400' : 'text-slate-400 hover:bg-neutral-700/50 hover:text-slate-200'}`}>
                        {item.count > 0 && (
                            <span className="absolute top-1 right-1/2 translate-x-4 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white ring-2 ring-neutral-800">
                                {item.count}
                            </span>
                        )}
                        {item.icon}
                        <span className="text-xs mt-1 font-semibold">{item.label}</span>
                        <div className={`absolute bottom-0 h-0.5 bg-cyan-500 rounded-full transition-all duration-300 ${activeTab === item.name ? 'w-1/2' : 'w-0'} group-hover:w-1/4`}></div>
                    </button>
                ))}
            </nav>
        </header>
    );
};

const PlayerCharacterTab = ({ myCharacter, victim, myCharacterSpecificClues, onOpenDirectory }) => {
    const [isVictimDossierOpen, setIsVictimDossierOpen] = useState(false);
    return (
        <div className="p-4 sm:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center mb-6">
                {myCharacter.idpic && (
                    <img 
                        src={`https://images.weserv.nl/?url=${encodeURIComponent(myCharacter.idpic)}&w=128&h=128&fit=cover&a=top`} 
                        alt={myCharacter.name} 
                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mr-0 sm:mr-6 mb-4 sm:mb-0 border-4 border-cyan-500/50 shadow-lg"
                    />
                )}
                <div className="text-center sm:text-left">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white">{myCharacter.name}</h2>
                    <p className="text-lg text-cyan-300">Your Role: {myCharacter.role}</p>
                </div>
            </div>

            <div className="bg-neutral-900/50 p-4 sm:p-6 rounded-lg mb-6 shadow-lg border border-neutral-800/80">
                <h3 className="text-xl font-bold text-white mb-3">Your Character Dossier</h3>
                
                <div className="space-y-3 text-slate-300">
                    <p><span className="font-bold text-slate-100">How to Act:</span> {myCharacter.howtoactyourpart || 'No specific instructions provided.'}</p>
                    <p><span className="font-bold text-slate-100">Costume:</span> {myCharacter.suggestedCostume || 'Not specified'}</p>
                    <p><span className="font-bold text-slate-100">Motive:</span> {myCharacter.motive}</p>
                </div>

                <div className="mt-4 p-4 bg-fuchsia-900/30 border border-fuchsia-500/30 rounded-lg">
                    <h4 className="font-bold text-fuchsia-300">Secret Information (Do NOT Share)</h4>
                    <p className="text-fuchsia-200 mt-1">{myCharacter.secretInfo}</p>
                </div>

                <div className="mt-4">
                    <h4 className="text-lg font-bold text-white">Your Clues</h4>
                    {myCharacterSpecificClues.length === 0 ? <p className="text-slate-400 italic text-sm mt-1">No specific clues assigned to your character.</p> : (
                        <ul className="list-disc list-inside text-slate-300 mt-2 space-y-1">
                            {myCharacterSpecificClues.map(clue => <li key={clue.id}><span className="font-semibold">{clue.description}:</span> {clue.content}</li>)}
                        </ul>
                    )}
                </div>

                {myCharacter.isKiller && (
                    <div className="bg-rose-900/50 shadow-lg p-4 rounded-lg mt-6 text-center border border-rose-500/50">
                        <p className="text-xl font-bold text-rose-300">YOU ARE THE KILLER!</p>
                        <p className="text-rose-200 mt-2">Your secret is safe. Blend in, deceive, and avoid suspicion.</p>
                    </div>
                )}

                <div className="bg-neutral-800/80 rounded-lg my-6 shadow-lg overflow-hidden border border-neutral-700">
                    <button onClick={() => setIsVictimDossierOpen(!isVictimDossierOpen)} className="w-full p-4 text-left text-xl font-bold text-cyan-300 flex justify-between items-center hover:bg-neutral-700/50 transition-colors">
                        <span>Victim Dossier</span>
                        <span className={`transition-transform duration-300 ${isVictimDossierOpen ? 'rotate-180' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </span>
                    </button>
                    {isVictimDossierOpen && victim && (
                        <div className="p-4 border-t border-neutral-700 animate-fade-in">
                            <h4 className="text-lg font-bold text-slate-100 mb-2">The Victim: {victim.name}</h4>
                            <p className="text-slate-300">{victim.secretInfo}</p>
                        </div>
                    )}
                </div>

                <button onClick={onOpenDirectory} className="w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-700 hover:to-fuchsia-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                    View Cast of Characters
                </button>
            </div>
        </div>
    );
};

const PlayerCluesTab = ({ globallyUnlockedClues, highlightedClues, onMarkSeen }) => {
    const { gameDetails } = useContext(GameContext);
    const characters = gameDetails?.characters || {};

    const renderClueContent = (clue) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let content = clue.content || '';
        const urls = content.match(urlRegex);
        const firstUrl = urls ? urls[0] : null;
        const textContent = firstUrl ? content.replace(firstUrl, '').trim() : content;

        let mediaElement = null;

        if (firstUrl) {
            const isImage = clue.type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(firstUrl);
            const isAudio = clue.type === 'audio' || /\.(mp3|wav|ogg)$/i.test(firstUrl);
            const isVideo = clue.type === 'video' || /\.(mp4|webm)$/i.test(firstUrl);
            
            if (isImage) {
                mediaElement = <img src={`https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/171717/FFFFFF?text=Image+Error`; }} />;
            } else if (isAudio) {
                mediaElement = <audio controls src={firstUrl} className="mt-2 w-full"></audio>;
            } else if (isVideo) {
                mediaElement = <video controls src={firstUrl} className="mt-2 w-full"></video>;
            } else {
                mediaElement = <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">{firstUrl}</a>;
            }
        }
        
        return (
            <div className="mt-2 pt-3 border-t border-neutral-700/50">
                {textContent && <p className="text-slate-300 whitespace-pre-wrap">{textContent}</p>}
                {mediaElement}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">Unlocked Evidence</h3>
                <button onClick={onMarkSeen} className="bg-cyan-600/80 text-white px-3 py-1 rounded-md text-sm hover:bg-cyan-700">Mark All as Seen</button>
            </div>
            {globallyUnlockedClues.length === 0 ? <p className="text-slate-400">No clues unlocked yet. Wait for the host to reveal them!</p> : (
                <ul className="space-y-4">
                    {globallyUnlockedClues.map(clue => {
                        const character = characters[clue.characterId];
                        const isNew = highlightedClues.has(clue.id);
                        return (
                            <li key={clue.id} className={`bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-lg shadow-lg relative overflow-hidden transition-all duration-500 ${isNew ? 'border-lime-400' : ''}`}>
                                {isNew && <span className="absolute top-0 right-0 bg-lime-400 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">NEW</span>}
                                <p className="font-bold text-slate-100 text-lg mb-1">{clue.description} <span className="text-sm text-slate-400 font-normal">(Regarding: {character ? `${character.name}` : 'Unknown'})</span></p>
                                <p className="text-sm text-slate-400 italic">Round {clue.round} | Type: {clue.type}</p>
                                {renderClueContent(clue)}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const PlayerNotesTab = ({ notes, setNotes }) => (
    <div className="p-4 sm:p-6 h-full flex flex-col animate-fade-in">
        <h3 className="text-2xl font-bold text-white mb-4">My Private Notes</h3>
        <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down your suspicions, theories, and important details here... Your notes are saved automatically."
            className="w-full flex-grow p-4 bg-neutral-900/70 text-slate-200 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-800/80 resize-none"
        />
    </div>
);

// Public Board
function PublicBoard() {
    const { userId, isHost, gameId, characterId, showConfirmation, showModalMessage, appId } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (gameId) {
            const messagesColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/messages`);
            const q = query(messagesColRef, orderBy('timestamp', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMessages(fetchedMessages);
            });
            return () => unsubscribe();
        }
    }, [gameId, appId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const myPlayer = playersInGame.find(p => p.id === userId);
        const senderName = isHost ? 'The Host' : (myPlayer?.name || 'Unknown Player');

        try {
            const messagesColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/messages`);
            await addDoc(messagesColRef, {
                text: newMessage,
                senderId: userId,
                senderName: senderName,
                characterId: characterId,
                timestamp: serverTimestamp()
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            showModalMessage("Failed to send message. Please try again.");
        }
    };

    const handleDeleteMessage = (messageId) => {
        showConfirmation("Are you sure you want to delete this message?", async () => {
            try {
                const messageDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/messages/${messageId}`);
                await deleteDoc(messageDocRef);
            } catch (error) {
                console.error("Error deleting message:", error);
                showModalMessage("Failed to delete message.");
            }
        });
    };

    return (
        <div className={`p-4 flex flex-col animate-fade-in ${isHost ? 'h-full bg-neutral-900/50 border border-neutral-800/80 rounded-lg' : 'h-full'}`}>
            <h3 className={`text-xl sm:text-2xl font-bold mb-4 text-center ${isHost ? 'text-white' : 'text-white'}`}>Public Message Board</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {messages.map(msg => {
                    const isMyMessage = msg.senderId === userId;
                    let senderDisplayName;
                    if (isHost) {
                        senderDisplayName = msg.senderName;
                    } else {
                        senderDisplayName = isMyMessage ? (gameDetails.characters[characterId]?.name || 'You') : 'A Mysterious Figure';
                    }

                    return (
                        <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg shadow-md ${isMyMessage ? 'bg-cyan-800/80' : 'bg-neutral-800'}`}>
                                <div className="flex justify-between items-center gap-4">
                                    <p className="font-bold text-cyan-300">{senderDisplayName}</p>
                                    {isHost && (
                                        <button onClick={() => handleDeleteMessage(msg.id)} className="text-xs text-slate-400 hover:text-rose-500">
                                            &times;
                                        </button>
                                    )}
                                </div>
                                <p className="text-slate-100 whitespace-pre-wrap mt-1">{msg.text}</p>
                                <p className="text-xs text-neutral-500 text-right mt-1">
                                    {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Send a public message..."
                    className="flex-grow p-3 bg-neutral-950/70 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition"
                />
                <button type="submit" className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-700 transition">
                    Send
                </button>
            </form>
        </div>
    );
}

// Private Chat
function PrivateChat() {
    const { userId, isHost, gameId, characterId, showModalMessage, unreadPrivateChats, setUnreadPrivateChats, selectedChat, setSelectedChat, appId } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const [mobileView, setMobileView] = useState('list');

    const generateChatId = (id1, id2) => [id1, id2].sort().join('_');

    useEffect(() => {
        if (selectedChat) {
            const chatId = isHost ? selectedChat : generateChatId(characterId, selectedChat);
            const messagesColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);
            const q = query(messagesColRef, orderBy('timestamp', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMessages(fetchedMessages);
            });
            return () => unsubscribe();
        }
    }, [selectedChat, gameId, appId, characterId, isHost]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        const senderIdentifier = isHost ? userId : characterId;
        const chatId = isHost ? selectedChat : generateChatId(characterId, selectedChat);
        const messagesColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);

        try {
            await addDoc(messagesColRef, {
                text: newMessage,
                senderId: senderIdentifier,
                timestamp: serverTimestamp()
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending private message:", error);
            showModalMessage("Failed to send message.");
        }
    };

    const handleSelectChat = (chatIdentifier) => {
        const chatId = isHost ? chatIdentifier : generateChatId(characterId, chatIdentifier);

        setSelectedChat(chatIdentifier);
        setMobileView('chat');
        setUnreadPrivateChats(prev => {
            const newCounts = { ...prev };
            if (newCounts[chatId] > 0) {
                newCounts[chatId] = 0;
            }
            return newCounts;
        });
    };

    const otherPlayers = playersInGame.filter(p => p.characterId && p.characterId !== characterId);

    const allChatPairs = playersInGame.reduce((pairs, p1) => {
        playersInGame.forEach(p2 => {
            if (p1.characterId && p2.characterId && p1.characterId < p2.characterId) {
                const chatId = generateChatId(p1.characterId, p2.characterId);
                if (!pairs.some(p => p.chatId === chatId)) {
                    pairs.push({ chatId, p1, p2 });
                }
            }
        });
        return pairs;
    }, []);

    if (isHost) {
        return (
            <div className="bg-neutral-900/50 border border-neutral-800/80 p-2 sm:p-4 rounded-lg shadow-lg flex flex-col h-full animate-fade-in">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 text-center">Private Conversations</h3>
                <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                    <div className={`w-full md:w-1/3 border-neutral-800 pr-0 md:pr-4 overflow-y-auto ${mobileView === 'chat' && selectedChat ? 'hidden md:block' : 'block'}`}>
                        <h4 className="text-lg font-bold text-slate-300 mb-2">Select a Conversation:</h4>
                        {allChatPairs.map(({ chatId, p1, p2 }) => {
                            const char1 = gameDetails.characters[p1.characterId];
                            const char2 = gameDetails.characters[p2.characterId];
                            const unreadCount = unreadPrivateChats[chatId] || 0;
                            if (!char1 || !char2) return null;
                            return (
                                <button key={chatId} onClick={() => handleSelectChat(chatId)} className={`relative w-full text-left p-2 rounded-md mb-1 flex justify-between items-center ${selectedChat === chatId ? 'bg-cyan-800' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                                    <span>{char1.name} & {char2.name}</span>
                                    {unreadCount > 0 && <span className="flex h-2 w-2 rounded-full bg-rose-500"></span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className={`w-full md:w-2/3 flex flex-col ${mobileView === 'list' || !selectedChat ? 'hidden md:flex' : 'flex'}`}>
                        {selectedChat ? (
                            <>
                                <button onClick={() => setMobileView('list')} className="md:hidden bg-neutral-700 text-white py-1 px-3 rounded-md mb-2 self-start">← Back</button>
                                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                                    {messages.map(msg => {
                                        const senderIsHost = msg.senderId === userId;
                                        const sender = senderIsHost ? { name: "The Host", idpic: "https://placehold.co/40x40/d946ef/171717?text=H" } : gameDetails.characters[msg.senderId];
                                        const senderName = sender?.name || 'Unknown';
                                        return (
                                            <div key={msg.id} className={`flex items-start gap-3`}>
                                                {sender?.idpic && <img src={senderIsHost ? sender.idpic : `https://images.weserv.nl/?url=${encodeURIComponent(sender.idpic)}&w=40&h=40&fit=cover&a=top`} alt={senderName} className="w-10 h-10 rounded-full object-cover border-2 border-neutral-600"/>}
                                                <div className={`flex-1 p-3 rounded-lg ${senderIsHost ? 'bg-fuchsia-900/50' : 'bg-neutral-700'}`}>
                                                    <p className={`font-bold ${senderIsHost ? 'text-fuchsia-400' : 'text-cyan-400'}`}>{senderName}</p>
                                                    <p className="text-slate-100 whitespace-pre-wrap mt-1">{msg.text}</p>
                                                    <p className="text-xs text-neutral-500 text-right mt-1">{msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Send a message as Host..." className="flex-grow p-3 bg-neutral-800/80 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition" />
                                    <button type="submit" className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-700 transition">Send</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-neutral-500">Select a conversation to view messages.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="p-4 flex flex-col h-full animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-4 text-center">Private Chat</h3>
            <div className="flex flex-col h-full overflow-hidden">
                {(!selectedChat || mobileView === 'list') ? (
                    <div className="overflow-y-auto">
                        <h4 className="text-lg font-bold text-slate-300 mb-2">Chat With:</h4>
                        {otherPlayers.map(player => {
                            const character = gameDetails.characters[player.characterId];
                            const chatId = generateChatId(characterId, player.characterId);
                            const unreadCount = unreadPrivateChats[chatId] || 0;
                            return (
                                <button key={player.id} onClick={() => handleSelectChat(player.characterId)} className={`relative w-full text-left p-2 rounded-md mb-1 flex justify-between items-center bg-neutral-900 border border-neutral-800 hover:bg-neutral-800`}>
                                    <div className="flex items-center gap-3">
                                        <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=40&h=40&fit=cover&a=top`} alt={character.name} className="w-10 h-10 rounded-full object-cover"/>
                                        <span className="font-semibold">{character.name}</span>
                                    </div>
                                    {unreadCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">{unreadCount}</span>}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center mb-2">
                            <button onClick={() => setSelectedChat(null)} className="bg-neutral-700 text-white p-2 rounded-md mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <h4 className="text-lg font-bold text-slate-100">Chat with {gameDetails.characters[selectedChat]?.name}</h4>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4 p-2 bg-black/30 rounded-lg">
                            {messages.map(msg => {
                                const isMyMessage = msg.senderId === characterId;
                                const senderIsHost = msg.senderId === gameDetails.hostId;
                                return (
                                    <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-lg shadow-md ${isMyMessage ? 'bg-cyan-800/80' : senderIsHost ? 'bg-fuchsia-900/50' : 'bg-neutral-800'}`}>
                                            {senderIsHost && <p className="font-bold text-fuchsia-400">The Host</p>}
                                            <p className="text-slate-100 whitespace-pre-wrap">{msg.text}</p>
                                            <p className="text-xs text-neutral-500 text-right mt-1">{msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={`Message ${gameDetails.characters[selectedChat]?.name}...`}
                                className="flex-grow p-3 bg-neutral-950/70 text-slate-100 rounded-lg shadow-inner placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-neutral-700 transition"
                            />
                            <button type="submit" className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-700 transition">Send</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

function CharacterDirectoryModal({ characters, players, onClose }) {
    const assignedCharacterIds = players.map(p => p.characterId).filter(Boolean);
    const characterList = Object.values(characters).filter(c => c.id !== 'rajinikanth' && assignedCharacterIds.includes(c.id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-neutral-900 p-6 rounded-lg shadow-xl max-w-4xl w-full border border-neutral-800 relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-3xl leading-none" aria-label="Close">&times;</button>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-6 text-center">Cast of Characters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-2">
                    {characterList.map(char => {
                        const player = players.find(p => p.characterId === char.id);
                        return (
                            <div key={char.id} className="bg-neutral-800/80 p-4 rounded-lg text-center">
                                <img src={`https://images.weserv.nl/?url=${encodeURIComponent(char.idpic)}&w=128&h=128&fit=cover&a=top`} alt={char.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-neutral-700"/>
                                <h4 className="text-xl font-bold text-slate-100">{char.name}</h4>
                                <p className="text-sm text-cyan-300">{char.role}</p>
                                <p className="text-sm text-neutral-500 mt-2">Played by: {player?.name || 'Unassigned'}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function VotingScreen() {
    const { userId, gameId, showModalMessage, showConfirmation, appId, addNotification } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const myPlayer = playersInGame.find(p => p.id === userId);

    const handleVote = (accusedId) => {
        if (!myPlayer || myPlayer.votedFor) {
            showModalMessage("You have already voted.");
            return;
        }
        const accusedCharacter = gameDetails.characters[accusedId];
        showConfirmation(`Are you sure you want to accuse ${accusedCharacter.name}? This cannot be undone.`, async () => {
            try {
                const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
                await updateDoc(playerDocRef, { votedFor: accusedId });
                addNotification("Your vote has been cast!");
            } catch (e) {
                console.error("Error casting vote:", e);
                showModalMessage("Failed to cast your vote. Please try again.");
            }
        });
    };

    if (myPlayer?.votedFor) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-neutral-800/50">
                <h2 className="text-3xl font-bold text-emerald-400 mb-4">Vote Cast!</h2>
                <p className="text-slate-300">You have accused <span className="font-bold">{gameDetails.characters[myPlayer.votedFor]?.name}</span>.</p>
                <p className="text-slate-400 mt-4">Waiting for the host to reveal the killer...</p>
                   <div className="mt-6"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-neutral-800/50">
            <div className="flex justify-center mb-6"><GameLogo /></div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-white mb-6">Who is the Killer?</h2>
            <p className="text-center text-slate-300 mb-8">The investigation is over. It's time to make your final accusation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {playersInGame.filter(p => p.characterId && p.characterId !== 'rajinikanth').map(player => {
                    const character = gameDetails.characters[player.characterId];
                    if (!character) return null;
                    return (
                        <div key={player.id} onClick={() => handleVote(player.characterId)} className="bg-neutral-900/80 p-4 rounded-lg shadow-lg text-center cursor-pointer border-2 border-transparent hover:border-cyan-500 hover:scale-105 transition-all duration-200 group">
                            <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=128&h=128&fit=cover&a=top`} alt={character.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-neutral-700 group-hover:border-cyan-500 transition-colors"/>
                            <h3 className="text-xl font-bold text-slate-100">{character.name}</h3>
                            <p className="text-sm text-cyan-300">{character.role}</p>
                            <p className="text-sm text-neutral-500 mt-2">Played by: {player.name}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function RevealScreen() {
    const { isHost, gameId, appId } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const characters = gameDetails?.characters || {};
    const killer = Object.values(characters).find(c => c.isKiller);
    const killerPlayer = killer ? playersInGame.find(p => p.characterId === killer.id) : null;

    const voteCounts = playersInGame.reduce((acc, player) => {
        if (player.votedFor) {
            acc[player.votedFor] = (acc[player.votedFor] || 0) + 1;
        }
        return acc;
    }, {});
    const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const totalVotes = sortedVotes.reduce((sum, [, count]) => sum + count, 0);

    const handleSeeAwards = async () => {
        if (!gameId) return;
        try {
            const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
            await updateDoc(gameDocRef, { gamePhase: 'awards' });
        } catch (e) { console.error("Error proceeding to awards:", e); }
    };

    return (
       <div className="w-full max-w-2xl mx-auto bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-neutral-800/50">
           <div className="flex justify-center mb-6"><GameLogo /></div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-white mb-6">The Verdict</h2>
            <div className="mb-8 bg-black/50 p-4 rounded-lg">
                <h3 className="text-2xl font-bold text-white mb-4">Final Votes:</h3>
                <ul className="space-y-3">
                    {sortedVotes.map(([charId, count]) => {
                        const character = characters[charId];
                        const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                        return (
                            <li key={charId} className="text-lg text-slate-300">
                                <div className="flex justify-between items-center mb-1">
                                    <span>{character ? `${character.name}` : 'Unknown'}</span>
                                    <span className="font-bold text-white">{count} vote(s)</span>
                                </div>
                                <div className="w-full bg-neutral-700 rounded-full h-2.5">
                                    <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </li>
                        );
                    })}
                     {sortedVotes.length === 0 && <p className="text-slate-400">No votes were cast.</p>}
                </ul>
            </div>
            {killer && (
                <div className="border-t-2 border-neutral-800/50 pt-6">
                    <h3 className="text-2xl font-bold text-slate-100 mb-4">The Killer was...</h3>
                    <img src={`https://images.weserv.nl/?url=${encodeURIComponent(killer.idpic)}&w=160&h=160&fit=cover&a=top`} alt={killer.name} className="w-40 h-40 rounded-full object-cover mx-auto mb-4 border-4 border-rose-500 shadow-lg"/>
                    <p className="text-3xl sm:text-4xl font-bold text-rose-400">{killer.name}!</p>
                    {killerPlayer && <p className="text-xl text-slate-300">(Played by {killerPlayer.name})</p>}
                    <p className="text-lg text-slate-300 mt-2">{killer.role}</p>
                    <p className="text-xl text-slate-300 mt-4">Motive:</p>
                    <p className="text-slate-400 italic mt-2">{killer.motive}</p>
                </div>
            )}
            {isHost && <button onClick={handleSeeAwards} className="mt-8 w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">Continue to Awards</button>}
        </div>
    );
}

export function HostVotingDashboard() {
    const { gameId, showConfirmation, appId, addNotification } = useContext(AuthContext);
    const { playersInGame } = useContext(GameContext);
    
    const votingPlayers = playersInGame.filter(p => p.characterId && p.characterId !== 'host');
    const votedCount = votingPlayers.filter(p => p.votedFor).length;
    const totalVoters = votingPlayers.length;
    const allPlayersVoted = votedCount === totalVoters;
    const progress = totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0;

    const handleRevealKiller = async () => {
        if (!gameId) return;
        showConfirmation("Are you sure you want to reveal the killer? This cannot be undone.", async () => {
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                await updateDoc(gameDocRef, { gamePhase: 'reveal' });
                addNotification("The killer has been revealed!");
            } catch (e) { console.error("Error revealing killer:", e); }
        });
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-neutral-800/50">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Live Voting Tally</h2>
            <p className="text-slate-400 text-center mb-6">Monitor players as they cast their final votes.</p>

            <div className="mb-6">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-slate-300">Voting Progress</span>
                    <span className="text-sm font-medium text-slate-300">{votedCount} / {totalVoters}</span>
                </div>
                <div className="w-full bg-neutral-700 rounded-full h-4">
                    <div className="bg-emerald-600 h-4 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {votingPlayers.map(player => (
                    <div key={player.id} className="flex justify-between items-center bg-neutral-800/80 p-3 rounded-lg">
                        <span className="text-slate-100">{player.name}</span>
                        {player.votedFor ? 
                            <span className="text-emerald-400 font-bold flex items-center gap-1">Voted</span> : 
                            <span className="text-amber-400 animate-pulse flex items-center gap-1">Waiting...</span>
                        }
                    </div>
                ))}
            </div>
            <button onClick={handleRevealKiller} disabled={!allPlayersVoted} className="w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                {allPlayersVoted ? 'Reveal The Killer' : 'Waiting for all votes...'}
            </button>
        </div>
    );
}

export function AwardsScreen({ handleFinishGame }) {
    const { isHost, gameId, appId } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const [awards, setAwards] = useState(null);

    useEffect(() => {
        const calculateAwards = async () => {
            if (gameDetails && playersInGame.length > 0) {
                const characters = gameDetails.characters || {};
                const killer = Object.values(characters).find(c => c.isKiller);
                if (!killer) return;

                const voteCounts = playersInGame.reduce((acc, player) => {
                    if (player.votedFor) {
                        acc[player.votedFor] = (acc[player.votedFor] || 0) + 1;
                    }
                    return acc;
                }, {});

                const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
                const mostVoted = sortedVotes.length > 0 ? sortedVotes[0] : null;
                const mostVotedCharacterId = mostVoted ? mostVoted[0] : null;

                const killerWon = mostVotedCharacterId !== killer.id;
                
                const masterSleuths = playersInGame.filter(p => p.votedFor === killer.id);
                
                let scapegoat = null;
                if (mostVoted && mostVotedCharacterId !== killer.id) {
                    const scapegoatPlayer = playersInGame.find(p => p.characterId === mostVotedCharacterId);
                    if (scapegoatPlayer) {
                        scapegoat = {
                            name: scapegoatPlayer.name,
                            characterName: characters[scapegoatPlayer.characterId]?.name
                        };
                    }
                }
                
                let masterOfDeception = null;
                if(killerWon) {
                    const killerPlayer = playersInGame.find(p => p.characterId === killer.id);
                    if(killerPlayer) masterOfDeception = killerPlayer;
                }

                // Chatterbox Calculation
                const messageCounts = {};
                playersInGame.forEach(p => { messageCounts[p.id] = 0; });

                const publicMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/messages`);
                const publicMessagesSnap = await getDocs(publicMessagesRef);
                publicMessagesSnap.forEach(doc => {
                    const msg = doc.data();
                    if(messageCounts[msg.senderId] !== undefined) {
                        messageCounts[msg.senderId]++;
                    }
                });

                const chatPairs = playersInGame.reduce((pairs, p1) => {
                    playersInGame.forEach(p2 => {
                        if (p1.characterId && p2.characterId && p1.id < p2.id) {
                            pairs.push([p1.characterId, p2.characterId].sort().join('_'));
                        }
                    });
                    return [...new Set(pairs)];
                }, []);

                for (const chatId of chatPairs) {
                    const privateMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);
                    const privateMessagesSnap = await getDocs(privateMessagesRef);
                    privateMessagesSnap.forEach(doc => {
                        const msg = doc.data();
                        const player = playersInGame.find(p => p.characterId === msg.senderId);
                        if (player && messageCounts[player.id] !== undefined) {
                            messageCounts[player.id]++;
                        }
                    });
                }
                
                let chatterbox = null;
                let maxMessages = -1;
                for(const playerId in messageCounts) {
                    if(messageCounts[playerId] > maxMessages) {
                        maxMessages = messageCounts[playerId];
                        chatterbox = playersInGame.find(p => p.id === playerId);
                    }
                }

                setAwards({
                    winningTeam: killerWon ? "The Killer" : "The Innocents",
                    masterSleuths,
                    mostSuspicious: scapegoat,
                    masterOfDeception,
                    chatterbox,
                });
            }
        };

        calculateAwards();
    }, [gameDetails, playersInGame, gameId, appId]);

    if (!awards) {
        return <div className="text-center p-8">Calculating awards...</div>;
    }

    return (
        <div className="w-full max-w-3xl mx-auto bg-neutral-900/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-neutral-800/50">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-white mb-2">Awards Ceremony</h2>
            <p className="text-amber-300 text-xl mb-8">{awards.winningTeam === 'The Killer' ? 'Deception was victorious!' : 'Justice has prevailed!'}</p>

            <div className="space-y-6">
                <div className="bg-neutral-900/50 p-6 rounded-lg border border-neutral-800">
                    <h3 className="text-2xl font-bold text-amber-400 mb-3">🏆 Winning Team 🏆</h3>
                    <p className="text-3xl font-bold">{awards.winningTeam}</p>
                </div>

                {awards.masterOfDeception && (
                     <div className="bg-neutral-900/50 p-6 rounded-lg border border-neutral-800">
                        <h3 className="text-2xl font-bold text-fuchsia-400 mb-3">😈 Master of Deception 😈</h3>
                        <p className="text-lg">The killer, <span className="font-bold">{gameDetails.characters[awards.masterOfDeception.characterId]?.name}</span> (played by <span className="font-bold">{awards.masterOfDeception.name}</span>), successfully evaded capture!</p>
                    </div>
                )}

                <div className="bg-neutral-900/50 p-6 rounded-lg border border-neutral-800">
                    <h3 className="text-2xl font-bold text-cyan-400 mb-3">🕵️‍♂️ Master Sleuths 🕵️‍♀️</h3>
                    {awards.masterSleuths.length > 0 ? (
                        <ul className="space-y-1">
                            {awards.masterSleuths.map(player => {
                                const character = gameDetails.characters[player.characterId];
                                return <li key={player.id} className="text-lg"><span className="font-bold">{player.name}</span> as {character?.name}</li>
                            })}
                        </ul>
                    ) : (
                        <p className="text-slate-400">The killer outsmarted everyone...</p>
                    )}
                </div>

                {awards.mostSuspicious && (
                    <div className="bg-neutral-900/50 p-6 rounded-lg border border-neutral-800">
                        <h3 className="text-2xl font-bold text-rose-400 mb-3">🎭 The Scapegoat 🎭</h3>
                        <p className="text-lg">The innocents wrongly accused <span className="font-bold">{awards.mostSuspicious.characterName}</span>, played by {awards.mostSuspicious.name}.</p>
                    </div>
                )}

                {awards.chatterbox && (
                     <div className="bg-neutral-900/50 p-6 rounded-lg border border-neutral-800">
                        <h3 className="text-2xl font-bold text-lime-400 mb-3">💬 Chatterbox 💬</h3>
                        <p className="text-lg"><span className="font-bold">{awards.chatterbox.name}</span> ({gameDetails.characters[awards.chatterbox.characterId]?.name}) couldn't stop talking!</p>
                    </div>
                )}
            </div>

            {isHost && <button onClick={handleFinishGame} className="mt-8 w-full bg-gradient-to-r from-neutral-700 to-neutral-800 hover:from-neutral-800 hover:to-neutral-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">Finish Game & Delete Room</button>}
        </div>
    );
}
