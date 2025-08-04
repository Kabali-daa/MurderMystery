import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from './firebase';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, writeBatch, getDocs, deleteDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';

import { AuthContext, GameContext } from './contexts';
import { NotificationContainer, ScriptLoader, Modal, ConfirmationModal } from './components/Common';
import { LandingPage, WaitingForAssignmentScreen, HostDashboard, PlayerDashboard, VotingScreen, RevealScreen, AwardsScreen, HostVotingDashboard } from './components/GameScreens';

function App() {
    // State management for the entire application
    const [currentUser, setCurrentUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [gameId, setGameId] = useState('');
    const [characterId, setCharacterId] = useState('');
    const [gameDetails, setGameDetails] = useState(null);
    const [clueStates, setClueStates] = useState({});
    const [playersInGame, setPlayersInGame] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [confirmation, setConfirmation] = useState({
        isOpen: false,
        message: '',
        onConfirm: () => {},
    });
    const [unreadPublicCount, setUnreadPublicCount] = useState(0);
    const [unreadPrivateChats, setUnreadPrivateChats] = useState({});
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedChat, setSelectedChat] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [isMuted, setIsMuted] = useState(false);

    // App ID from environment, with a fallback
    const appId = process.env.REACT_APP_APP_ID || 'murder-mystery-game-app';

    // Function to add an activity to the recent activity log
    const addActivity = (activity) => {
        setRecentActivity(prev => [activity, ...prev].slice(0, 5));
    };

    // Function to show a temporary notification
    const addNotification = useCallback((message) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    // Effect for handling user authentication state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setUserId(user.uid);
                const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setIsHost(userData.isHost || false);
                    setGameId(userData.gameId || '');
                } else {
                    setIsHost(false);
                    setGameId('');
                }
                setIsAuthReady(true);
            } else {
                setCurrentUser(null);
                setUserId(null);
                setIsHost(false);
                setGameId('');
                setCharacterId('');
                try {
                    if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
                        await signInWithCustomToken(auth, window.__initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Error during automatic sign-in:", error);
                    setIsAuthReady(true);
                }
            }
        });
        return () => unsubscribe();
    }, [appId]);

    // Effect for listening to game state changes
    useEffect(() => {
        if (gameId && isAuthReady) {
            const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
            const unsubscribeGame = onSnapshot(gameDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setGameDetails({
                        characters: data.characters || {},
                        clues: data.clues || [],
                        currentRound: data.currentRound || 0,
                        hostId: data.hostId,
                        gamePhase: data.gamePhase || 'investigation',
                    });
                    const newClueStates = (data.clues || []).reduce((acc, clue) => {
                        acc[clue.id] = { unlocked: clue.unlocked || false, unlockedAt: clue.unlockedAt || null };
                        return acc;
                    }, {});
                    setClueStates(newClueStates);
                } else {
                    // Game document has been deleted
                    setGameDetails(null);
                    setClueStates({});
                }
            });

            const playersColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/players`);
            const unsubscribePlayers = onSnapshot(playersColRef, (snapshot) => {
                const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPlayersInGame(players);
            });

            return () => {
                unsubscribeGame();
                unsubscribePlayers();
            };
        }
    }, [gameId, isAuthReady, appId]);

    // Effect to handle player character assignment and kicking
    useEffect(() => {
        if (userId && gameId && !isHost && isAuthReady) {
            const isPlayerInGame = playersInGame.some(p => p.id === userId);
            
            // If gameDetails becomes null, it means the game ended.
            // Or, if playersInGame is loaded and the player is not in it, they were kicked.
            if (gameDetails === null || (playersInGame.length > 0 && !isPlayerInGame)) {
                setGameId('');
                setCharacterId('');
                const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
                updateDoc(userProfileRef, { gameId: null, characterId: null, isHost: false });
            } else if (isPlayerInGame) {
                const myPlayerData = playersInGame.find(p => p.id === userId);
                if (myPlayerData && myPlayerData.characterId !== characterId) {
                    setCharacterId(myPlayerData.characterId || '');
                }
            }
        }
    }, [playersInGame, gameDetails, userId, gameId, isHost, characterId, appId, isAuthReady]);

    // Effect for real-time message notifications
    useEffect(() => {
        if (!gameId || !userId || !gameDetails?.characters) return;
        const unsubscribers = [];

        // Public messages
        const publicMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/messages`);
        const qPublic = query(publicMessagesRef, where("timestamp", ">", new Date()));
        const unsubPublic = onSnapshot(qPublic, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" && change.doc.data().senderId !== userId) {
                    if (activeTab !== 'publicBoard') setUnreadPublicCount(prev => prev + 1);
                    addActivity({ type: 'public_message', sender: change.doc.data().senderName, text: change.doc.data().text });
                }
            });
        });
        unsubscribers.push(unsubPublic);

        // Private messages
        const generateChatId = (id1, id2) => [id1, id2].sort().join('_');
        const relevantChatIds = new Set();

        if (isHost) {
            playersInGame.forEach(p1 => {
                playersInGame.forEach(p2 => {
                    if (p1.characterId && p2.characterId && p1.characterId < p2.characterId) {
                        relevantChatIds.add(generateChatId(p1.characterId, p2.characterId));
                    }
                });
            });
        } else {
            playersInGame.forEach(p => {
                if (p.characterId && p.characterId !== characterId) {
                    relevantChatIds.add(generateChatId(characterId, p.characterId));
                }
            });
        }

        relevantChatIds.forEach(chatId => {
            const privateMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);
            const qPrivate = query(privateMessagesRef, where("timestamp", ">", new Date()));
            const unsubPrivate = onSnapshot(qPrivate, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const newMsgData = change.doc.data();
                        const amITheSender = isHost ? newMsgData.senderId === userId : newMsgData.senderId === characterId;

                        if (!amITheSender) {
                            const currentlySelectedChatId = isHost ? selectedChat : (selectedChat ? generateChatId(characterId, selectedChat) : null);
                            if (activeTab !== 'privateChat' || chatId !== currentlySelectedChatId) {
                                setUnreadPrivateChats(prev => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
                            }
                            addActivity({ type: 'private_message', sender: 'Someone', receiver: 'Someone', text: newMsgData.text });
                        }
                    }
                });
            });
            unsubscribers.push(unsubPrivate);
        });


        return () => unsubscribers.forEach(unsub => unsub());
    }, [gameId, userId, characterId, isHost, playersInGame, gameDetails, activeTab, appId, addActivity, selectedChat]);


    // --- Modal and Confirmation Handlers ---
    const showModalMessage = (message) => {
        setModalContent(message);
        setShowModal(true);
    };
    const closeModal = () => setShowModal(false);
    const showConfirmation = (message, onConfirmAction) => {
        setConfirmation({ isOpen: true, message, onConfirm: () => { onConfirmAction(); closeConfirmation(); } });
    };
    const closeConfirmation = () => setConfirmation({ isOpen: false, message: '', onConfirm: () => {} });

    // --- Core Game Actions ---
    const handleCreateGame = async (gameIdInput, sheetUrl) => {
        if (!userId) {
            showModalMessage("Please wait for authentication to complete.");
            return;
        }
        if (!gameIdInput || !sheetUrl) {
            showModalMessage("Please enter a Game ID and a Google Sheet URL.");
            return;
        }
        if (!window.Papa) {
            showModalMessage("Parsing library not loaded. Please wait a moment and try again.");
            return;
        }

        try {
            const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameIdInput}`);
            const gameSnap = await getDoc(gameDocRef);
            if (gameSnap.exists()) {
                showModalMessage("Game ID already exists. Please choose a different one.");
                return;
            }

            const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);

            if (!sheetIdMatch) {
                showModalMessage("Invalid Google Sheet URL. Please check the link and try again.");
                return;
            }

            const sheetId = sheetIdMatch[1];
            const gid = gidMatch ? gidMatch[1] : '0';
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

            window.Papa.parse(csvUrl, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        const newCharacters = {};
                        const newClues = [];
                        results.data.forEach(row => {
                            if (row.id) {
                                const { clue1, Typeofclue1, clue2, Typeofclue2, clue3, Typeofclue3, ...charData } = row;
                                newCharacters[row.id] = {
                                    ...charData,
                                    isKiller: String(charData.isKiller).toLowerCase() === 'true'
                                };

                                const cluesToAdd = [
                                    { content: clue1, type: Typeofclue1, round: 1 },
                                    { content: clue2, type: Typeofclue2, round: 2 },
                                    { content: clue3, type: Typeofclue3, round: 3 }
                                ].filter(c => c.content);

                                cluesToAdd.forEach((clueInfo) => {
                                    newClues.push({
                                        id: `${row.id}-c${clueInfo.round}`,
                                        characterId: row.id,
                                        round: clueInfo.round,
                                        type: clueInfo.type || 'text',
                                        description: `Round ${clueInfo.round} Clue for ${row.name}`,
                                        content: clueInfo.content,
                                        unlocked: false
                                    });
                                });
                            }
                        });

                        if (Object.keys(newCharacters).length === 0) {
                            showModalMessage("Import failed. Could not find valid character data. Ensure sheet has an 'id' column.");
                            return;
                        }

                        await setDoc(gameDocRef, {
                            currentRound: 1,
                            hostId: userId,
                            characters: newCharacters,
                            clues: newClues,
                            createdAt: serverTimestamp(),
                            gamePhase: 'investigation'
                        });

                        const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
                        await setDoc(userProfileRef, { isHost: true, gameId: gameIdInput, characterId: 'host' }, { merge: true });

                        setGameId(gameIdInput);
                        setIsHost(true);
                        setCharacterId('host');

                    } catch (error) {
                        showModalMessage("Error processing game data from Google Sheet. Please check the sheet format.");
                        console.error("Game Data Processing Error:", error);
                    }
                },
                error: (error) => {
                    showModalMessage(`Error fetching data from Google Sheet: ${error.message}`);
                }
            });

        } catch (e) {
            console.error("Error creating game: ", e);
            showModalMessage("Failed to create game. Please try again.");
        }
    };

    const handleJoinGame = async (inputGameId, playerName) => {
        if (!userId || !inputGameId || !playerName.trim()) {
            showModalMessage("Please enter all required fields to join.");
            return;
        }
        
        const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${inputGameId}`);
        try {
            const gameSnap = await getDoc(gameDocRef);
            if (!gameSnap.exists()) {
                showModalMessage("Game ID not found. Please check and try again.");
                return;
            }

            const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${inputGameId}/players/${userId}`);
            await setDoc(playerDocRef, {
                name: playerName.trim(),
                characterId: null,
                isHost: false,
                joinedAt: serverTimestamp()
            }, { merge: true });

            const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            await setDoc(userProfileRef, { isHost: false, gameId: inputGameId, characterId: null }, { merge: true });

            setGameId(inputGameId);
            setIsHost(false);
            setCharacterId(null);
        } catch (e) {
            console.error("Error joining game: ", e);
            showModalMessage("Failed to join game. Please try again.");
        }
    };

    const handleResetGame = () => {
        showConfirmation(
            "Are you sure you want to end this game for everyone? The game room will be deleted.",
            async () => {
                if (!gameId || !isHost) return;
                
                try {
                    const batch = writeBatch(db);
                    
                    const playersColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/players`);
                    const playersSnapshot = await getDocs(playersColRef);
                    
                    playersSnapshot.forEach((playerDoc) => {
                        const userProfileRef = doc(db, `artifacts/${appId}/users/${playerDoc.id}/profile/data`);
                        batch.update(userProfileRef, { gameId: null, isHost: false, characterId: null });
                        batch.delete(playerDoc.ref);
                    });

                    // Delete subcollections
                    const subcollections = ['messages', 'privateChats'];
                    for (const sub of subcollections) {
                        const subColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/${sub}`);
                        const subColSnapshot = await getDocs(subColRef);
                        for (const subDoc of subColSnapshot.docs) {
                            if (sub === 'privateChats') {
                                const messagesInPrivateChatRef = collection(subDoc.ref, 'messages');
                                const messagesSnapshot = await getDocs(messagesInPrivateChatRef);
                                messagesSnapshot.forEach(msgDoc => batch.delete(msgDoc.ref));
                            }
                            batch.delete(subDoc.ref);
                        }
                    }
                    
                    const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                    batch.delete(gameDocRef);

                    // Also update the host's profile
                    const hostProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
                    batch.update(hostProfileRef, { gameId: null, isHost: false, characterId: null });

                    await batch.commit();

                    addNotification("The game has ended and the room has been deleted!");

                    // Reset host's local state immediately
                    setGameId('');
                    setIsHost(false);
                    setCharacterId('');

                } catch (e) {
                    console.error("Error finishing game:", e);
                    showModalMessage("Failed to finish game. Please check console for details.");
                }
            }
        );
    };

    // --- Render Logic ---
    const renderContent = () => {
        if (!gameId) {
            return <LandingPage onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />;
        }
        switch (gameDetails?.gamePhase) {
            case 'reveal': return <RevealScreen />;
            case 'awards': return <AwardsScreen handleFinishGame={isHost ? handleResetGame : null} />;
            case 'voting': return isHost ? <HostVotingDashboard /> : <VotingScreen />;
            case 'investigation':
            default:
                if (isHost) {
                    return <HostDashboard handleResetGame={handleResetGame} showConfirmation={showConfirmation} setActiveTab={setActiveTab} activeTab={activeTab} />;
                }
                return characterId ? <PlayerDashboard setActiveTab={setActiveTab} activeTab={activeTab} /> : <WaitingForAssignmentScreen />;
        }
    };

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-slate-100 font-sans">
                <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xl font-semibold text-slate-300">Authenticating...</span>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ currentUser, userId, isHost, gameId, characterId, showModalMessage, showConfirmation, addNotification, unreadPublicCount, setUnreadPublicCount, unreadPrivateChats, setUnreadPrivateChats, selectedChat, setSelectedChat, appId, recentActivity, addActivity, isMuted, setIsMuted }}>
            <GameContext.Provider value={{ gameDetails, clueStates, playersInGame }}>
                <ScriptLoader />
                <div className="min-h-screen bg-black font-sans text-slate-200">
                    <NotificationContainer notifications={notifications} />
                    {isHost && gameId ? (
                        renderContent()
                    ) : (
                        <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-2 sm:p-4">
                            {renderContent()}
                        </div>
                    )}
                    {showModal && <Modal message={modalContent} onClose={closeModal} />}
                    {confirmation.isOpen && <ConfirmationModal message={confirmation.message} onConfirm={confirmation.onConfirm} onCancel={closeConfirmation} />}
                </div>
            </GameContext.Provider>
        </AuthContext.Provider>
    );
}

export default App;
