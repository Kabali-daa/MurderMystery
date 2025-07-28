import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, writeBatch, getDocs, deleteDoc, addDoc, serverTimestamp, query, orderBy, where, limit } from 'firebase/firestore';

// Firebase Configuration and Initialization
// IMPORTANT: Replace this with your own Firebase config object!
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Context for Auth and Game State
const AuthContext = createContext(null);
const GameContext = createContext(null);

// Main App Component
function App() {
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
  // --- State for unread message counts ---
  const [unreadPublicCount, setUnreadPublicCount] = useState(0);
  const [unreadPrivateChats, setUnreadPrivateChats] = useState({}); // Shape: { [chatId]: count }
  const [activeTab, setActiveTab] = useState('overview'); // Centralize active tab state
  const [selectedChat, setSelectedChat] = useState(null); // Centralize selected chat state

  // CORRECTED: This should be a simple string, not from process.env for this setup.
  const appId = 'murder-mystery-game-app';

  const addNotification = React.useCallback((message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000); // Notification disappears after 5 seconds
  }, []);


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
      } else {
        setCurrentUser(null);
        setUserId(null);
        setIsHost(false);
        setGameId('');
        setCharacterId(''); 
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [appId]);

  useEffect(() => {
    const signIn = async () => {
      if (!currentUser && isAuthReady) {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Error signing in:", error);
          try {
            await signInAnonymously(auth);
          } catch (anonError) {
            console.error("Error signing in anonymously:", anonError);
          }
        }
      }
    };
    if (isAuthReady) {
      signIn();
    }
  }, [isAuthReady, currentUser]);

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
          setGameDetails(null);
          setClueStates({});
        }
      }, (error) => console.error("Error listening to game state:", error));

      const playersColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/players`);
      const unsubscribePlayers = onSnapshot(playersColRef, (snapshot) => {
        const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlayersInGame(players);
      }, (error) => console.error("Error listening to players:", error));

      return () => {
        unsubscribeGame();
        unsubscribePlayers();
      };
    }
  }, [gameId, isAuthReady, appId]);

  useEffect(() => {
    if (userId && gameId && !isHost) {
        const myPlayerData = playersInGame.find(p => p.id === userId);
        if (myPlayerData) {
            if (myPlayerData.characterId !== characterId) {
                setCharacterId(myPlayerData.characterId || '');
            }
        } else if (gameDetails) {
           if (gameId) {
               setGameId('');
               setCharacterId('');
               const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
               updateDoc(userProfileRef, { gameId: null, characterId: null, isHost: false });
           }
        }
    }
  }, [playersInGame, gameDetails, userId, gameId, isHost, characterId, appId]);
  
  // --- Centralized Notification Listener ---
  useEffect(() => {
    if (!gameId || !userId || !gameDetails?.characters) return;

    const myIdentifier = isHost ? userId : characterId;
    if (!myIdentifier) return;

    const unsubscribers = [];
    const initialLoadFlags = {};

    // 1. Public Chat Listener
    const publicMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/messages`);
    const qPublic = query(publicMessagesRef, where("timestamp", ">", new Date()));
    const unsubPublic = onSnapshot(qPublic, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const newMsgData = change.doc.data();
                if (newMsgData.senderId !== userId) {
                    if (activeTab !== 'publicBoard') {
                        setUnreadPublicCount(prev => prev + 1);
                    }
                }
            }
        });
    });
    unsubscribers.push(unsubPublic);

    // 2. Private Chat Listeners
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
        initialLoadFlags[chatId] = true;
        const privateMessagesRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);
        const qPrivate = query(privateMessagesRef, where("timestamp", ">", new Date()));
        const unsubPrivate = onSnapshot(qPrivate, (snapshot) => {
            if (initialLoadFlags[chatId]) {
                initialLoadFlags[chatId] = false;
                return;
            }
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const newMsgData = change.doc.data();
                    if (newMsgData.senderId !== myIdentifier) {
                        const currentlySelectedChatId = isHost ? selectedChat : (selectedChat ? generateChatId(characterId, selectedChat) : null);
                        if (activeTab !== 'privateChat' && activeTab !== 'privateChats' || chatId !== currentlySelectedChatId) {
                            setUnreadPrivateChats(prev => ({
                                ...prev,
                                [chatId]: (prev[chatId] || 0) + 1,
                            }));
                        }
                    }
                }
            });
        });
        unsubscribers.push(unsubPrivate);
    });

    return () => {
        unsubscribers.forEach(unsub => unsub());
    };

  }, [gameId, userId, characterId, isHost, playersInGame, gameDetails, activeTab, selectedChat, appId]);


  const showModalMessage = (message) => {
    setModalContent(message);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent('');
  };

  const showConfirmation = (message, onConfirmAction) => {
    setConfirmation({
        isOpen: true,
        message: message,
        onConfirm: () => {
            onConfirmAction();
            setConfirmation({ isOpen: false, message: '', onConfirm: () => {} });
        }
    });
  };

  const closeConfirmation = () => {
    setConfirmation({ isOpen: false, message: '', onConfirm: () => {} });
  };

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
              showModalMessage("Import failed. Could not find valid character data in the Google Sheet. Ensure it has an 'id' column.");
              return;
            }

            const initialGameData = {
              currentRound: 1,
              hostId: userId,
              characters: newCharacters,
              clues: newClues,
              createdAt: new Date().toISOString(),
              gamePhase: 'investigation'
            };

            await setDoc(gameDocRef, initialGameData);

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
    if (!userId) {
      showModalMessage("Please wait for authentication to complete.");
      return;
    }
    if (!inputGameId) {
      showModalMessage("Please enter a Game ID.");
      return;
    }
    if (!playerName || !playerName.trim()) {
      showModalMessage("Please enter your name to join.");
      return;
    }


    const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${inputGameId}`);
    try {
      const gameSnap = await getDoc(gameDocRef);
      if (!gameSnap.exists()) {
        console.error(`[Join Game] Game ID ${inputGameId} not found at ${gameDocRef.path}.`);
        showModalMessage("Game ID not found. Please check and try again.");
        return;
      }

      const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${inputGameId}/players/${userId}`);
      await setDoc(playerDocRef, {
        name: playerName.trim(),
        characterId: null,
        isHost: false,
        joinedAt: new Date().toISOString()
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
              if (!gameId || !isHost) {
                  showModalMessage("Only the host can perform this action.");
                  return;
              }
              try {
                  const playersColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/players`);
                  const playersSnapshot = await getDocs(playersColRef);
                  const batch = writeBatch(db);

                  playersSnapshot.forEach((playerDoc) => {
                      batch.delete(playerDoc.ref);
                  });

                  await batch.commit();

                  const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                  await deleteDoc(gameDocRef);


                  showModalMessage("The game has ended and the room has been deleted!");
                  
                  setGameId('');
                  setIsHost(false);
                  setCharacterId('');
                  const hostProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
                  await updateDoc(hostProfileRef, { gameId: null, isHost: false, characterId: null });


              } catch (e) {
                  console.error("Error finishing game:", e);
                  showModalMessage("Failed to finish game. Please check console for details.");
              }
          }
      );
  };


  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
        <div className="text-xl font-semibold animate-pulse">Loading game...</div>
      </div>
    );
  }

  let contentToRender;
  if (!gameId) {
    contentToRender = <LandingPage onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />;
  } else if (gameDetails?.gamePhase === 'reveal') {
    contentToRender = <RevealScreen handleFinishGame={isHost ? handleResetGame : null} />;
  } else if (gameDetails?.gamePhase === 'voting') {
    contentToRender = isHost ? <HostVotingDashboard /> : <VotingScreen />;
  } else if (isHost) {
    contentToRender = <HostDashboard gameDetails={gameDetails} handleResetGame={handleResetGame} showConfirmation={showConfirmation} setActiveTab={setActiveTab} activeTab={activeTab} />;
  } else if (characterId) {
    contentToRender = <PlayerDashboard gameDetails={gameDetails} setActiveTab={setActiveTab} activeTab={activeTab} />;
  } else {
    contentToRender = <WaitingForAssignmentScreen gameDetails={gameDetails} />;
  }

  return (
    <AuthContext.Provider value={{ currentUser, userId, isHost, gameId, characterId, showModalMessage, showConfirmation, addNotification, unreadPublicCount, setUnreadPublicCount, unreadPrivateChats, setUnreadPrivateChats, selectedChat, setSelectedChat }}>
      <GameContext.Provider value={{ gameDetails, clueStates, playersInGame }}>
       <ScriptLoader />
        <div className="min-h-screen bg-cover bg-center bg-fixed" style={{backgroundImage: "url('https://static.vecteezy.com/system/resources/thumbnails/023/602/482/small_2x/silhouette-of-man-in-old-fashioned-hat-and-coat-at-night-street-generative-ai-photo.jpg')"}}>
         <div className="min-h-screen w-full bg-black/60 backdrop-blur-sm flex flex-col items-center p-2 sm:p-4 font-lato text-zinc-100">
          <NotificationContainer notifications={notifications} />
          {/* --- MOBILE OPTIMIZATION: Logo size reduced on mobile --- */}
          <img src="https://upload.wikimedia.org/wikipedia/fr/d/da/Murder_Mystery.png" alt="Murder Mystery Logo" className="w-full max-w-[280px] sm:max-w-xs md:max-w-sm mb-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />

          {userId && (
            <div className="bg-black/30 text-zinc-300 p-2 rounded-md mb-4 text-xs sm:text-sm shadow-inner">
              Your User ID: <span className="font-mono text-red-400">{userId}</span>
            </div>
          )}

          {contentToRender}
        </div>
        {/* Modals are now siblings to the main content div to ensure proper centering */}
        {showModal && <Modal message={modalContent} onClose={closeModal} />}
        {confirmation.isOpen && <ConfirmationModal message={confirmation.message} onConfirm={confirmation.onConfirm} onCancel={closeConfirmation} />}
       </div>
      </GameContext.Provider>
    </AuthContext.Provider>
  );
}

function NotificationContainer({ notifications }) {
    return (
        <div className="fixed top-5 right-5 z-[100] w-full max-w-xs">
            <div className="flex flex-col-reverse gap-2">
                {notifications.map(n => (
                    <div key={n.id} className="bg-green-600/90 text-white p-3 rounded-lg shadow-lg animate-fade-in-out">
                        {n.message}
                    </div>
                ))}
            </div>
        </div>
    );
}


// Helper component to load external scripts
function ScriptLoader() {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js";
        script.async = true;
        document.body.appendChild(script);
        
        const fonts = document.createElement('link');
        fonts.href = "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@700&family=Special+Elite&display=swap";
        fonts.rel = "stylesheet";
        document.head.appendChild(fonts);

        const styles = document.createElement('style');
        styles.innerHTML = `
            @keyframes fade-in-out {
                0% { opacity: 0; transform: translateY(-20px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-20px); }
            }
            .animate-fade-in-out {
                animation: fade-in-out 5s ease-in-out forwards;
            }
        `;
        document.head.appendChild(styles);

        return () => {
            document.body.removeChild(script);
            document.head.removeChild(fonts);
            document.head.removeChild(styles);
        };
    }, []);
    return null;
}

// Landing Page Component
function LandingPage({ onCreateGame, onJoinGame }) {
  const [gameIdInput, setGameIdInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');

  return (
    <div className="w-full max-w-md bg-black/50 backdrop-blur-md p-4 sm:p-8 rounded-xl shadow-lg border border-zinc-700/50">
      {/* --- MOBILE OPTIMIZATION: Title size and margin --- */}
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
            onChange={(e) => setPlayerNameInput(e.target.value)}
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
            onChange={(e) => setGameIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-full p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
          />
      </div>
      
      <div className="border-t border-zinc-700 my-6"></div>

      {/* Host Section */}
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
                onChange={(e) => setSheetUrl(e.target.value)}
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

      {/* Player Section */}
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
}

// A simple icon component to use as a placeholder for non-image clues.
const MagnifyingGlassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

/**
 * A component that displays a single clue in a compact grid format.
 * @param {object} props - The component props.
 * @param {object} props.clue - The clue data object.
 * @param {string} props.characterName - The name of the character this clue belongs to.
 * @param {string} props.characterRole - The role of the character.
 * @param {string} props.characterIdpic - The image URL for the character's profile picture.
 * @param {boolean} props.isUnlocked - Whether the clue is currently unlocked.
 * @param {function} props.onToggleClue - Function to call when the lock/unlock button is clicked.
 * @param {function} props.onViewClue - Function to call when the clue's thumbnail is clicked.
 */
function ClueGridItem({ clue, characterName, characterRole, characterIdpic, isUnlocked, onToggleClue, onViewClue }) {
    const isImageUrl = characterIdpic && /\.(jpg|jpeg|png|gif|webp)$/i.test(characterIdpic);

    return (
        <div className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${isUnlocked ? 'bg-zinc-800/80' : 'bg-zinc-950/70'}`}>
            <div
                onClick={() => onViewClue(clue)}
                className="w-24 h-24 bg-black/40 rounded-md flex items-center justify-center cursor-pointer mb-2 overflow-hidden border-2 border-transparent hover:border-red-500"
                title={`Click to view details for: ${clue.description}`}
            >
                {isImageUrl ? (
                    <img
                        src={`https://images.weserv.nl/?url=${encodeURIComponent(characterIdpic)}&w=96&h=96&fit=cover&a=top`}
                        alt={characterName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/96x96/1a1a1a/ffffff?text=Error'; }}
                    />
                ) : (
                    <MagnifyingGlassIcon />
                )}
            </div>
            <p className="text-sm text-zinc-300 font-semibold w-full text-center truncate" title={characterName}>{characterName}</p>
            <p className="text-xs text-zinc-500 w-full text-center truncate" title={characterRole}>({characterRole})</p>
             <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleClue(clue.id, isUnlocked);
                }}
                className={`w-full mt-2 px-2 py-1 rounded font-bold text-sm transition duration-300 ease-in-out shadow-md ${
                    isUnlocked
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-black'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
                {isUnlocked ? 'Lock' : 'Unlock'}
            </button>
        </div>
    );
}

/**
 * A modal component to display the full details of a clue.
 * @param {object} props - The component props.
 * @param {object} props.clue - The clue data to display.
 * @param {boolean} props.isUnlocked - The current lock state of the clue.
 * @param {object} props.characters - The full list of characters to look up names.
 * @param {function} props.onClose - Function to call to close the modal.
 * @param {function} props.onToggleClue - Function to call to lock or unlock the clue.
 */
function ClueDetailModal({ clue, isUnlocked, characters, onClose, onToggleClue }) {
    // This helper function renders the clue content, including media like images, audio, or video.
    const renderClueContent = (clue) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const googleDriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
        const urls = clue.content.match(urlRegex);
        let textContent = clue.content;

        const mediaElement = () => {
            if (!urls || urls.length === 0) return null;
            const firstUrl = urls[0];
            textContent = textContent.replace(firstUrl, '').trim();
            const googleDriveMatch = firstUrl.match(googleDriveRegex);

            if (googleDriveMatch) {
                const fileId = googleDriveMatch[1];
                if (clue.type === 'image' || clue.type === 'audio') {
                    return <iframe src={`https://drive.google.com/file/d/${fileId}/preview`} className="mt-2 w-full h-48 rounded-md" frameBorder="0"></iframe>;
                }
            }

            // Fallback for direct links
            switch (clue.type) {
                case 'image':
                    const proxiedImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
                    return <img src={proxiedImageUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/000000/FFFFFF?text=Image+Error`; }} />;
                case 'audio':
                    return <audio controls src={firstUrl} className="mt-2 w-full"></audio>;
                case 'video':
                    return <video controls src={firstUrl} className="mt-2 w-full"></video>;
                default:
                    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(firstUrl)) {
                         const defaultProxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
                         return <img src={defaultProxiedUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/000000/FFFFFF?text=Image+Error'; }} />;
                    }
                    return <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{firstUrl}</a>;
            }
        };

        return (
            <>
                {mediaElement()}
                {textContent && <p className="text-zinc-300 mt-2">{textContent}</p>}
            </>
        );
    };

    // This function handles the action and then closes the modal.
    const handleToggleAndClose = () => {
        onToggleClue(clue.id, isUnlocked);
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full border border-zinc-700 relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-zinc-400 hover:text-white text-3xl leading-none" aria-label="Close">&times;</button>
                <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">{clue.description}</h3>
                <p className="text-sm text-zinc-400 mb-4">
                    Regarding: {characters[clue.characterId]?.name || 'Unknown'} | Round {clue.round}
                </p>

                <div className="mb-6 max-h-[50vh] overflow-y-auto p-2 bg-black/20 rounded">
                    {renderClueContent(clue)}
                </div>

                <div className="flex justify-center space-x-4">
                    <button
                        onClick={handleToggleAndClose}
                        className={`px-6 py-2 rounded-lg font-bold transition duration-300 ease-in-out shadow-md ${
                            isUnlocked
                                ? 'bg-yellow-600 hover:bg-yellow-700 text-black'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                    >
                        {isUnlocked ? 'Lock This Clue' : 'Unlock This Clue'}
                    </button>
                     <button
                        onClick={onClose}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// Host Dashboard Component
function HostDashboard({ gameDetails, handleResetGame, showConfirmation, setActiveTab, activeTab }) {
  const { gameId, showModalMessage, setUnreadPublicCount, setUnreadPrivateChats, unreadPublicCount, unreadPrivateChats } = useContext(AuthContext);
  const { clueStates, playersInGame } = useContext(GameContext);
  const appId = 'murder-mystery-game-app';

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
        const unassignedPlayers = playersInGame.filter(p => !p.characterId);
        if (unassignedPlayers.length > 0) {
            showModalMessage("A new player has joined! Go to the 'Player Management' tab to assign them a character.");
        }
    }
    prevPlayerCountRef.current = playersInGame.length;
  }, [playersInGame, showModalMessage]);

  // Effect for round completion notification
  useEffect(() => {
    const assignedCharacterIds = playersInGame.map(p => p.characterId).filter(Boolean);
    const currentRoundClues = allClues.filter(c => c.round === currentRound && assignedCharacterIds.includes(c.characterId));
    
    if (currentRoundClues.length === 0 || currentRound >= 3 || notifiedRound === currentRound) {
        return;
    }

    const allCurrentRoundCluesUnlocked = currentRoundClues.every(c => clueStates[c.id]?.unlocked);

    if (allCurrentRoundCluesUnlocked) {
        showModalMessage(`All clues for Round ${currentRound} have been revealed! You can now advance to the next round.`);
        setNotifiedRound(currentRound);
    }
  }, [clueStates, currentRound, allClues, showModalMessage, notifiedRound, playersInGame]);

  const handleViewClue = (clue) => {
    setViewingClue(clue);
  };

  const handleCloseClueModal = () => {
    setViewingClue(null);
  };

  const handleToggleClue = async (clueId, isUnlocked) => {
    if (!gameId) return;
    try {
      const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
      const updatedClues = allClues.map(clue =>
        clue.id === clueId ? { ...clue, unlocked: !isUnlocked, unlockedAt: new Date().toISOString() } : clue
      );
      await updateDoc(gameDocRef, { clues: updatedClues });
    } catch (e) {
      console.error("Error toggling clue:", e);
      showModalMessage("Failed to update clue. Please try again.");
    }
  };

  const handleAdvanceRound = async () => {
    if (!gameId) return;
    if (currentRound >= 3) {
        showModalMessage("You are already at the final round.");
        return;
    }
    try {
      const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
      await updateDoc(gameDocRef, {
        currentRound: currentRound + 1
      });
      showModalMessage(`Advanced to Round ${currentRound + 1}!`);
    } catch (e) {
      console.error("Error advancing round:", e);
      showModalMessage("Failed to advance round. Please try again.");
    }
  };

  const handleStartVoting = async () => {
    if (!gameId) return;
    showConfirmation("Are you sure you want to end the investigation and start the final voting?", async () => {
        try {
            const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
            await updateDoc(gameDocRef, { gamePhase: 'voting' });
            showModalMessage("Voting has begun!");
        } catch (e) {
            console.error("Error starting voting:", e);
            showModalMessage("Failed to start voting phase.");
        }
    });
  };

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
            characterId: editedPlayer.characterId || null // Ensure it's null if unassigned
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
        `Are you sure you want to kick this player? They will be removed from the game.`,
        async () => {
            try {
                const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${playerId}`);
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
    if (tabName === 'publicBoard') {
      setUnreadPublicCount(0);
    }
    // We don't clear all private chats here anymore, it's handled per-chat
    setActiveTab(tabName);
  };

  if (!gameDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
        <div className="text-xl font-semibold animate-pulse">Loading game...</div>
      </div>
    );
  }

  const assignedCharacterIds = playersInGame.map(p => p.characterId).filter(Boolean);

  return (
    <div className="w-full lg:max-w-4xl bg-black/50 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-lg border border-zinc-700/50">
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-center mb-6 text-red-500">Host Dashboard</h2>
      <p className="text-lg text-zinc-300 mb-4 text-center">Game ID: <span className="font-bold text-red-500">{gameId}</span></p>

      <div className="flex flex-wrap justify-center border-b border-red-800/50 mb-6">
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'overview' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`}
          onClick={() => handleTabChange('overview')}
        >
          Overview
        </button>
        <button
          className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'players' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`}
          onClick={() => handleTabChange('players')}
        >
          Players
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'publicBoard' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`}
          onClick={() => handleTabChange('publicBoard')}
        >
          Public Board
          {unreadPublicCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unreadPublicCount}
            </span>
          )}
        </button>
        <button
          className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'privateChats' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`}
          onClick={() => handleTabChange('privateChats')}
        >
          Private Chats
          {totalUnreadPrivate > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {totalUnreadPrivate}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <p className="text-xl text-zinc-300 mb-6 text-center">Current Round: <span className="font-bold text-red-500">{currentRound}</span></p>
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
              {Array.from({ length: currentRound }, (_, i) => i + 1).map(roundNum => (
                  <button
                      key={roundNum}
                      onClick={() => setVisibleRound(roundNum)}
                      className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${visibleRound === roundNum ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'}`}
                  >
                      {roundNum}
                  </button>
              ))}
          </div>

          <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">Clues for Round {visibleRound}</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allClues
                  .filter(clue => clue.round === visibleRound && assignedCharacterIds.includes(clue.characterId))
                  .map(clue => {
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
                  })
              }
          </div>
        </>
      )}

      {activeTab === 'players' && (
        <div className="bg-black/30 p-4 rounded-lg shadow-lg border border-zinc-700/50">
          <h3 className="text-2xl font-playfair-display font-bold text-red-500 mb-4">Manage Players</h3>
          {playersInGame.length === 0 ? (
            <p className="text-zinc-400">No players have joined yet.</p>
          ) : (
            <ul className="space-y-3">
              {playersInGame.map(player => {
                const character = characters[player.characterId];
                return (
                    <li key={player.id} className="p-3 bg-zinc-900/70 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg">
                    {editingPlayerId === player.id ? (
                        <div className="w-full space-y-2">
                        <label className="block text-zinc-300 text-sm">Player Name:</label>
                        <input
                            type="text"
                            value={editedPlayer?.name || ''}
                            onChange={(e) => setEditedPlayer({ ...editedPlayer, name: e.target.value })}
                            className="w-full p-2 bg-zinc-800 text-zinc-100 rounded-lg shadow-inner"
                        />
                        <label className="block text-zinc-300 text-sm">Assign Character:</label>
                        <select
                            value={editedPlayer?.characterId || ''}
                            onChange={(e) => setEditedPlayer({ ...editedPlayer, characterId: e.target.value })}
                            className="w-full p-2 bg-zinc-800 text-zinc-100 rounded-lg shadow-inner"
                        >
                            <option value="">-- Unassign --</option>
                            {Object.values(characters).filter(char => char.id !== 'rajinikanth').map(char => (
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
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/48x48/1a1a1a/ffffff?text=??'; }}
                                />
                            )}
                            <div>
                                <span className="font-semibold text-zinc-100">{player.name}</span>
                                <span className="block text-sm text-zinc-400">
                                {character ? `${character.name} (${character.role})` : 'Character Not Assigned'}
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
      
      {activeTab === 'publicBoard' && <PublicBoard />}
      
      {activeTab === 'privateChats' && <PrivateChat />}
      
      {viewingClue && (
        <ClueDetailModal
            clue={viewingClue}
            isUnlocked={clueStates[clue.id]?.unlocked || false}
            characters={characters}
            onClose={handleCloseClueModal}
            onToggleClue={handleToggleClue}
        />
      )}
    </div>
  );
}

// Player Dashboard Component
function PlayerDashboard({ gameDetails, setActiveTab, activeTab }) {
  const { userId, gameId, characterId, setUnreadPublicCount, setUnreadPrivateChats, unreadPublicCount, unreadPrivateChats } = useContext(AuthContext);
  const { clueStates, playersInGame } = useContext(GameContext);
  const appId = 'murder-mystery-game-app';

  const [isVictimDossierOpen, setIsVictimDossierOpen] = useState(false);
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
    if (tabName === 'publicBoard') {
      setUnreadPublicCount(0);
    }
    // Individual chat clearing is handled in the PrivateChat component
    setActiveTab(tabName);
  };
  
  // Fetch initial notes and seen clues
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

  // Debounced save for notes
  useEffect(() => {
      if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
          if (userId && gameId) {
              const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
              try {
                  await updateDoc(playerDocRef, { notes: notes });
              } catch (e) {
                  console.error("Failed to save notes:", e);
              }
          }
      }, 1000); // Save after 1 second of inactivity

      return () => {
          if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
          }
      };
  }, [notes, userId, gameId, appId]);

  const globallyUnlockedClues = allClues
    .filter(clue => !clue.recipientCharacterId && clueStates[clue.id]?.unlocked && clue.round <= currentRound)
    .sort((a, b) => new Date(clueStates[b.id]?.unlockedAt) - new Date(clueStates[a.id]?.unlockedAt));
  
  const myCharacterSpecificClues = allClues.filter(clue =>
    clue.characterId === characterId || clue.source === characterId
  );

  // Effect to handle the "NEW" badge timeout
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
            }, 10000); // 10 seconds
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
    const newClueIds = globallyUnlockedClues.map(c => c.id).filter(id => !seenClues.includes(id));
    if (newClueIds.length > 0) {
        const updatedSeenClues = [...seenClues, ...newClueIds];
        setSeenClues(updatedSeenClues);
        setHighlightedClues(current => {
            const newSet = new Set(current);
            newClueIds.forEach(id => newSet.delete(id));
            return newSet;
        });
        const playerDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}/players/${userId}`);
        try {
            await updateDoc(playerDocRef, { seenClues: updatedSeenClues });
        } catch(e) {
            console.error("Failed to mark clues as seen:", e);
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
        textContent = textContent.replace(firstUrl, '').trim();
        const googleDriveMatch = firstUrl.match(googleDriveRegex);

        if (googleDriveMatch) {
            const fileId = googleDriveMatch[1];
            if (clue.type === 'image') {
                return <img src={`https://drive.google.com/uc?export=view&id=${fileId}`} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/000000/FFFFFF?text=Image+Error'; }} />;
            }
            if (clue.type === 'audio') {
                return <audio controls src={`https://drive.google.com/uc?export=media&id=${fileId}`} className="mt-2 w-full"></audio>;
            }
        }

        // Fallback for direct links
        switch (clue.type) {
            case 'image':
                const proxiedImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
                return <img src={proxiedImageUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/000000/FFFFFF?text=Image+Error`; }} />;
            case 'audio':
                return <audio controls src={firstUrl} className="mt-2 w-full"></audio>;
            case 'video':
                return <video controls src={firstUrl} className="mt-2 w-full"></video>;
            default:
                if (/\.(jpg|jpeg|png|gif|webp)$/i.test(firstUrl)) {
                    const defaultProxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(firstUrl)}`;
                    return <img src={defaultProxiedUrl} alt={clue.description} className="mt-2 rounded-md max-w-full h-auto" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/000000/FFFFFF?text=Image+Error`; }} />;
                }
                return <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{firstUrl}</a>;
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
         <img src={`https://images.weserv.nl/?url=${encodeURIComponent(myCharacter.idpic)}&w=128&h=128&fit=cover&a=top`} alt={myCharacter.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-red-700 shadow-lg"/>
      )}
      <h2 className="text-2xl sm:text-3xl font-playfair-display font-bold text-center mb-2 text-red-500">{myCharacter.name}</h2>
      <p className="text-lg text-zinc-300 mb-2 text-center">Role: {myCharacter.role}</p>
      <p className="text-lg text-zinc-300 mb-6 text-center">Current Round: <span className="font-bold text-red-500">{currentRound}</span></p>

      <div className="flex flex-wrap justify-center border-b border-red-800/50 mb-6">
        <button className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'character' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`} onClick={() => handleTabChange('character')}>Character</button>
        <button className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'clues' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`} onClick={() => handleTabChange('clues')}>Clues</button>
        <button className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'publicBoard' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`} onClick={() => handleTabChange('publicBoard')}>
          Public
          {unreadPublicCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unreadPublicCount}
            </span>
          )}
        </button>
        <button className={`relative px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'privateChat' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`} onClick={() => handleTabChange('privateChat')}>
          Private
          {totalUnreadPrivate > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {totalUnreadPrivate}
            </span>
          )}
        </button>
        <button className={`px-3 py-2 text-base sm:text-lg font-semibold rounded-t-lg transition-colors duration-200 ${activeTab === 'notes' ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-zinc-100'}`} onClick={() => handleTabChange('notes')}>Notes</button>
      </div>

      {activeTab === 'character' && (
        <div className="bg-zinc-800/80 p-4 rounded-lg mb-6 shadow-lg">
            <h3 className="text-xl font-playfair-display font-bold text-red-400 mb-3">Your Character Details</h3>
            <p className="text-zinc-300 mt-2"><span className="font-bold text-zinc-100">How to Act Your Part:</span> {myCharacter.howtoactyourpart || 'No specific instructions provided.'}</p>
            <p className="text-zinc-300 mt-2"><span className="font-bold text-zinc-100">Suggested Costume:</span> {myCharacter.suggestedCostume || 'Not specified'}</p>
            <p className="text-zinc-300 mt-2"><span className="font-bold text-zinc-100">Secret Information (DO NOT SHARE):</span> {myCharacter.secretInfo}</p>
            <p className="text-zinc-300 mt-2"><span className="font-bold text-zinc-100">Motive:</span> {myCharacter.motive}</p>

            <h4 className="text-lg font-bold text-red-300 mt-4">Your Character's Clues</h4>
            {myCharacterSpecificClues.length === 0 ? (
            <p className="text-zinc-400 italic">No specific clues assigned to your character.</p>
            ) : (
            <ul className="list-disc list-inside text-zinc-300 mt-2">
                {myCharacterSpecificClues.map(clue => (
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
                <span>{isVictimDossierOpen ? '−' : '+'}</span>
                </button>
                {isVictimDossierOpen && victim && (
                <div className="p-4 border-t border-zinc-700">
                    <h4 className="text-lg font-bold text-zinc-100 mb-2">The Victim: {victim.name}</h4>
                    <p className="text-zinc-300">{victim.secretInfo}</p>
                </div>
                )}
            </div>
            
            <button onClick={() => setIsDirectoryOpen(true)} className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                View Cast of Characters
            </button>
        </div>
      )}

      {activeTab === 'clues' && (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-playfair-display font-bold text-red-500">Globally Unlocked Clues</h3>
                <button onClick={handleMarkCluesAsSeen} className="bg-red-800 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700">Mark All as Seen</button>
            </div>
            {globallyUnlockedClues.length === 0 ? (
            <p className="text-zinc-400">No clues unlocked yet. Wait for the host to reveal them!</p>
            ) : (
            <ul className="space-y-4">
                {globallyUnlockedClues.map(clue => {
                    const character = gameDetails.characters[clue.characterId];
                    const isNew = highlightedClues.has(clue.id);
                    return (
                        <li key={clue.id} className={`bg-zinc-800/80 p-4 rounded-lg shadow-lg relative overflow-hidden ${isNew ? 'border-2 border-yellow-400' : ''}`}>
                            {isNew && <span className="absolute top-0 right-0 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">NEW</span>}
                            <p className="font-bold text-zinc-100 text-lg mb-1">
                                {clue.description} 
                                <span className="text-sm text-zinc-400 font-normal">
                                    (Regarding: {character ? `${character.name} - ${character.role}` : 'Unknown'})
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

      {activeTab === 'publicBoard' && <PublicBoard />}
      
      {activeTab === 'privateChat' && <PrivateChat />}

      {activeTab === 'notes' && (
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
      
      {isDirectoryOpen && <CharacterDirectoryModal characters={gameDetails.characters} players={playersInGame} onClose={() => setIsDirectoryOpen(false)} />}
      
    </div>
  );
}

// NEW COMPONENT: Public Board
function PublicBoard() {
    const { userId, isHost, gameId, characterId, showConfirmation, showModalMessage } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const appId = 'murder-mystery-game-app';
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
        <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
            <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">Public Message Board</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {messages.map(msg => {
                    const isMyMessage = msg.senderId === userId;
                    let senderDisplayName;

                    if (isMyMessage) {
                        senderDisplayName = isHost ? 'The Host' : (gameDetails.characters[characterId]?.name || 'You');
                    } else {
                        if (isHost) {
                            // Host sees the character name of the player who sent the message
                            senderDisplayName = gameDetails.characters[msg.characterId]?.name || msg.senderName || 'Unknown Player';
                        } else {
                            // Player sees an anonymous name for others
                            senderDisplayName = 'A Mysterious Figure';
                        }
                    }
                    
                    return (
                        <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${isMyMessage ? 'bg-red-900/70' : 'bg-zinc-800/80'}`}>
                                <div className="flex justify-between items-center gap-4">
                                    <p className="font-bold text-red-300">{senderDisplayName}</p>
                                    {isHost && !isMyMessage && (
                                        <button onClick={() => handleDeleteMessage(msg.id)} className="text-xs text-zinc-400 hover:text-red-500">
                                            &times;
                                        </button>
                                    )}
                                </div>
                                <p className="text-zinc-100 whitespace-pre-wrap mt-1">{msg.text}</p>
                                <p className="text-xs text-zinc-500 text-right mt-1">
                                    {msg.timestamp?.toDate().toLocaleTimeString()}
                                    {isHost && <span className="italic"> ({msg.senderName})</span>}
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
                    className="flex-grow p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
                />
                <button type="submit" className="bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:from-red-700 hover:to-red-900 transition">
                    Send
                </button>
            </form>
        </div>
    );
}

// NEW COMPONENT: Private Chat
function PrivateChat() {
    const { userId, isHost, gameId, characterId, showModalMessage, unreadPrivateChats, setUnreadPrivateChats, selectedChat, setSelectedChat } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const appId = 'murder-mystery-game-app';
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
        
        const chatId = generateChatId(characterId, selectedChat);
        const messagesColRef = collection(db, `artifacts/${appId}/public/data/games/${gameId}/privateChats/${chatId}/messages`);
        
        try {
            await addDoc(messagesColRef, {
                text: newMessage,
                senderId: characterId,
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
                    pairs.push({chatId, p1, p2});
                }
            }
        });
        return pairs;
    }, []);

    if (isHost) {
        return (
            <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
                <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">Private Conversations</h3>
                <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                    {/* Sidebar for conversations */}
                    <div className={`w-full md:w-1/3 border-zinc-700 pr-0 md:pr-4 overflow-y-auto ${mobileView === 'chat' && selectedChat ? 'hidden md:block' : 'block'}`}>
                        <h4 className="text-lg font-bold text-zinc-300 mb-2">Select a Conversation:</h4>
                        {allChatPairs.map(({chatId, p1, p2}) => {
                            const char1 = gameDetails.characters[p1.characterId];
                            const char2 = gameDetails.characters[p2.characterId];
                            const unreadCount = unreadPrivateChats[chatId] || 0;
                            if (!char1 || !char2) return null;
                            return (
                                <button key={chatId} onClick={() => handleSelectChat(chatId)} className={`relative w-full text-left p-2 rounded-md mb-1 flex justify-between items-center ${selectedChat === chatId ? 'bg-red-800/80' : 'bg-zinc-800/80 hover:bg-zinc-700/80'}`}>
                                    <span>{char1.name} & {char2.name}</span>
                                    {unreadCount > 0 && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {/* Chat window */}
                    <div className={`w-full md:w-2/3 flex flex-col ${mobileView === 'list' || !selectedChat ? 'hidden md:flex' : 'flex'}`}>
                        {selectedChat ? (
                             <>
                                <button onClick={() => setMobileView('list')} className="md:hidden bg-zinc-700 text-white py-1 px-3 rounded-md mb-2 self-start">← Back</button>
                                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                                    {messages.map(msg => {
                                        const sender = gameDetails.characters[msg.senderId];
                                        return (
                                            <div key={msg.id} className={`flex items-start gap-3`}>
                                                {sender?.idpic && <img src={`https://images.weserv.nl/?url=${encodeURIComponent(sender.idpic)}&w=40&h=40&fit=cover&a=top`} alt={sender.name} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-600"/>}
                                                <div className="flex-1 p-3 rounded-lg bg-zinc-800/80">
                                                    <p className="font-bold text-red-300">{sender?.name || 'Unknown'}</p>
                                                    <p className="text-zinc-100 whitespace-pre-wrap mt-1">{msg.text}</p>
                                                    <p className="text-xs text-zinc-500 text-right mt-1">{msg.timestamp?.toDate().toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                             </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500">Select a conversation to view messages.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
            <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">Private Chat</h3>
            <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                {/* Sidebar for contacts */}
                <div className={`w-full md:w-1/3 md:border-r border-zinc-700 pr-0 md:pr-4 overflow-y-auto ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
                    <h4 className="text-lg font-bold text-zinc-300 mb-2">Chat With:</h4>
                    {otherPlayers.map(player => {
                        const character = gameDetails.characters[player.characterId];
                        const chatId = generateChatId(characterId, player.characterId);
                        const unreadCount = unreadPrivateChats[chatId] || 0;
                        return (
                            <button key={player.id} onClick={() => handleSelectChat(player.characterId)} className={`relative w-full text-left p-2 rounded-md mb-1 flex justify-between items-center ${selectedChat === player.characterId ? 'bg-red-800/80' : 'bg-zinc-800/80 hover:bg-zinc-700/80'}`}>
                                <div className="flex items-center gap-2">
                                    <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=32&h=32&fit=cover&a=top`} alt={character.name} className="w-8 h-8 rounded-full object-cover"/>
                                    <span>{character.name}</span>
                                </div>
                                {unreadCount > 0 && (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {/* Chat window */}
                <div className={`w-full md:w-2/3 flex flex-col ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
                    {selectedChat ? (
                        <>
                            <div className="flex items-center mb-2">
                                <button onClick={() => setMobileView('list')} className="md:hidden bg-zinc-700 text-white py-1 px-3 rounded-md mr-2">← Back</button>
                                <h4 className="text-lg font-bold text-zinc-100">Chat with {gameDetails.characters[selectedChat]?.name}</h4>
                            </div>
                            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                                {messages.map(msg => {
                                    const isMyMessage = msg.senderId === characterId;
                                    return (
                                        <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-lg ${isMyMessage ? 'bg-red-900/70' : 'bg-zinc-800/80'}`}>
                                                <p className="text-zinc-100 whitespace-pre-wrap">{msg.text}</p>
                                                <p className="text-xs text-zinc-500 text-right mt-1">{msg.timestamp?.toDate().toLocaleTimeString()}</p>
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
                                    className="flex-grow p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
                                />
                                <button type="submit" className="bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:from-red-700 hover:to-red-900 transition">Send</button>
                            </form>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">Select a player to start a conversation.</div>
                    )}
                </div>
            </div>
        </div>
    );
}


// NEW COMPONENT: Character Directory Modal
function CharacterDirectoryModal({ characters, players, onClose }) {
    const assignedCharacterIds = players.map(p => p.characterId).filter(Boolean);
    const characterList = Object.values(characters).filter(c => c.id !== 'rajinikanth' && assignedCharacterIds.includes(c.id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-4xl w-full border border-zinc-700 relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-zinc-400 hover:text-white text-3xl leading-none" aria-label="Close">&times;</button>
                <h3 className="text-2xl sm:text-3xl font-playfair-display font-bold text-red-500 mb-6 text-center">Cast of Characters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-2">
                    {characterList.map(char => {
                        const player = players.find(p => p.characterId === char.id);
                        return (
                            <div key={char.id} className="bg-zinc-800/80 p-4 rounded-lg text-center">
                                <img src={`https://images.weserv.nl/?url=${encodeURIComponent(char.idpic)}&w=128&h=128&fit=cover&a=top`} alt={char.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-zinc-700"/>
                                <h4 className="text-xl font-bold text-zinc-100">{char.name}</h4>
                                <p className="text-sm text-zinc-400">{char.role}</p>
                                <p className="text-sm text-zinc-500 mt-2">Played by: {player?.name || 'Unassigned'}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Waiting for assignment screen
function WaitingForAssignmentScreen() {
  const { gameDetails } = useContext(GameContext);
  const victim = gameDetails?.characters ? gameDetails.characters['rajinikanth'] : null;

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


// Generic Modal Component for messages
function Modal({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-zinc-700">
        <p className="text-zinc-100 text-lg mb-6">{message}</p>
        <button
          onClick={onClose}
          className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// Confirmation Modal Component
function ConfirmationModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-zinc-700">
                <p className="text-zinc-100 text-lg mb-6">{message}</p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onConfirm}
                        className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                        Confirm
                    </button>
                    <button
                        onClick={onCancel}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// Voting Screen for Players
function VotingScreen() {
    const { userId, gameId, showModalMessage, showConfirmation } = useContext(AuthContext);
    const { playersInGame, gameDetails } = useContext(GameContext);
    const appId = 'murder-mystery-game-app';
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
                showModalMessage("Your vote has been cast!");
            } catch (e) {
                console.error("Error casting vote:", e);
                showModalMessage("Failed to cast your vote. Please try again.");
            }
        });
    };

    if (myPlayer?.votedFor) {
        return (
            <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-zinc-700/50">
                <h2 className="text-3xl font-playfair-display font-bold text-red-500 mb-4">Vote Cast!</h2>
                <p className="text-zinc-300">You have accused {gameDetails.characters[myPlayer.votedFor]?.name}.</p>
                <p className="text-zinc-400 mt-4">Waiting for the host to reveal the killer...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg border border-zinc-700/50">
            <h2 className="text-3xl sm:text-4xl font-playfair-display font-bold text-center text-red-500 mb-6">Who is the Killer?</h2>
            <p className="text-center text-zinc-300 mb-8">The investigation is over. It's time to make your final accusation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {playersInGame.map(player => {
                    const character = gameDetails.characters[player.characterId];
                    if (!character || character.id === 'rajinikanth') return null;
                    return (
                        <div key={player.id} onClick={() => handleVote(player.characterId)} className="bg-zinc-800/80 p-4 rounded-lg shadow-lg text-center cursor-pointer hover:bg-red-900/80 hover:scale-105 transition-transform duration-200">
                            <img src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=128&h=128&fit=cover&a=top`} alt={character.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-zinc-700"/>
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

// Reveal Screen for All
function RevealScreen({ handleFinishGame }) {
    const { playersInGame, gameDetails } = useContext(GameContext);
    const characters = gameDetails?.characters || {};
    const killer = Object.values(characters).find(c => c.isKiller);

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
                               {character ? `${character.name} (${character.role})` : 'Unknown Character'}: <span className="font-bold text-white">{count} vote(s)</span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {killer && (
                <div className="border-t-2 border-red-800/50 pt-6">
                    <h3 className="text-2xl font-playfair-display font-bold text-zinc-100 mb-4">The Killer was...</h3>
                    <img src={`https://images.weserv.nl/?url=${encodeURIComponent(killer.idpic)}&w=160&h=160&fit=cover&a=top`} alt={killer.name} className="w-40 h-40 rounded-full object-cover mx-auto mb-4 border-4 border-red-500 shadow-lg"/>
                    <p className="text-3xl sm:text-4xl font-playfair-display font-bold text-red-500">{killer.name}!</p>
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

// Host Voting Dashboard
function HostVotingDashboard() {
    const { gameId, showConfirmation } = useContext(AuthContext);
    const { playersInGame } = useContext(GameContext);
    const appId = 'murder-mystery-game-app';

    const allPlayersVoted = playersInGame.every(p => p.votedFor || p.characterId === 'host');
    
    const handleRevealKiller = async () => {
        if (!gameId) return;
         showConfirmation("Are you sure you want to reveal the killer? This cannot be undone.", async () => {
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/games/${gameId}`);
                await updateDoc(gameDocRef, { gamePhase: 'reveal' });
            } catch (e) {
                console.error("Error revealing killer:", e);
            }
        });
    };

    return (
        <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md p-8 rounded-xl shadow-lg text-center border border-zinc-700/50">
            <h2 className="text-3xl font-playfair-display font-bold text-red-500 mb-6">Live Voting Tally</h2>
            <ul className="space-y-3 mb-8">
                {playersInGame.map(player => (
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
                {allPlayersVoted ? 'Reveal The Killer' : 'Waiting for all votes...'}
            </button>
        </div>
    );
}


export default App;
