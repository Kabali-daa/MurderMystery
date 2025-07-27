import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase/firebase";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import NotificationContainer from "./NotificationContainer";
import ScriptLoader from "./ScriptLoader";
import Modal from "./Modal";
import ConfirmationModal from "./ConfirmationModal";
import LandingPage from "./LandingPage";
import HostDashboard from "./HostDashboard";
import PlayerDashboard from "./PlayerDashboard";
import WaitingForAssignmentScreen from "./WaitingForAssignmentScreen";
import RevealScreen from "./RevealScreen";
import HostVotingDashboard from "./HostVotingDashboard";
import VotingScreen from "./VotingScreen";

import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  writeBatch,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [gameId, setGameId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [gameDetails, setGameDetails] = useState(null);
  const [clueStates, setClueStates] = useState({});
  const [playersInGame, setPlayersInGame] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });
  const [unreadPublicCount, setUnreadPublicCount] = useState(0);
  const [unreadPrivateChats, setUnreadPrivateChats] = useState({});
  const [activeTab, setActiveTab] = useState("overview");

  const addNotification = React.useCallback((message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  // Authentication and user state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);
        const userDocRef = doc(
          db,
          `artifacts/${appId}/users/${user.uid}/profile/data`
        );
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setIsHost(userData.isHost || false);
          setGameId(userData.gameId || "");
        } else {
          setIsHost(false);
          setGameId("");
        }
      } else {
        setCurrentUser(null);
        setUserId(null);
        setIsHost(false);
        setGameId("");
        setCharacterId("");
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const signIn = async () => {
      if (!currentUser && isAuthReady) {
        try {
          if (
            typeof __initial_auth_token !== "undefined" &&
            __initial_auth_token
          ) {
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

  // Game state listeners
  useEffect(() => {
    if (gameId && isAuthReady) {
      const gameDocRef = doc(
        db,
        `artifacts/${appId}/public/data/games/${gameId}`
      );
      const unsubscribeGame = onSnapshot(
        gameDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setGameDetails({
              characters: data.characters || {},
              clues: data.clues || [],
              currentRound: data.currentRound || 0,
              hostId: data.hostId,
              gamePhase: data.gamePhase || "investigation",
            });
            const newClueStates = (data.clues || []).reduce((acc, clue) => {
              acc[clue.id] = {
                unlocked: clue.unlocked || false,
                unlockedAt: clue.unlockedAt || null,
              };
              return acc;
            }, {});
            setClueStates(newClueStates);
          } else {
            setGameDetails(null);
            setClueStates({});
          }
        },
        (error) => console.error("Error listening to game state:", error)
      );

      const playersColRef = collection(
        db,
        `artifacts/${appId}/public/data/games/${gameId}/players`
      );
      const unsubscribePlayers = onSnapshot(
        playersColRef,
        (snapshot) => {
          const players = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setPlayersInGame(players);
        },
        (error) => console.error("Error listening to players:", error)
      );

      return () => {
        unsubscribeGame();
        unsubscribePlayers();
      };
    }
  }, [gameId, isAuthReady]);

  // Character assignment and user state
  useEffect(() => {
    if (userId && gameId && !isHost) {
      const myPlayerData = playersInGame.find((p) => p.id === userId);
      if (myPlayerData) {
        if (myPlayerData.characterId !== characterId) {
          setCharacterId(myPlayerData.characterId || "");
        }
      } else if (gameDetails) {
        if (gameId) {
          setGameId("");
          setCharacterId("");
          const userProfileRef = doc(
            db,
            `artifacts/${appId}/users/${userId}/profile/data`
          );
          updateDoc(userProfileRef, {
            gameId: null,
            characterId: null,
            isHost: false,
          });
        }
      }
    }
  }, [
    playersInGame,
    gameDetails,
    userId,
    gameId,
    isHost,
    characterId,
    appId,
  ]);

  // Notification listeners for public/private chats
  useEffect(() => {
    if (!gameId || !userId || !gameDetails?.characters) return;

    const myIdentifier = isHost ? userId : characterId;
    if (!myIdentifier) return;

    const unsubscribers = [];

    // Public Chat Listener
    // ... code for notification listeners is the same as in your original ...

    // Private Chat Listeners
    // ... code for notification listeners is the same as in your original ...

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    gameId,
    userId,
    characterId,
    isHost,
    playersInGame,
    gameDetails,
    addNotification,
    activeTab,
  ]);

  // Modal/Confirmation helpers
  const showModalMessage = (message) => {
    setModalContent(message);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setModalContent("");
  };
  const showConfirmation = (message, onConfirmAction) => {
    setConfirmation({
      isOpen: true,
      message: message,
      onConfirm: () => {
        onConfirmAction();
        setConfirmation({ isOpen: false, message: "", onConfirm: () => {} });
      },
    });
  };
  const closeConfirmation = () => {
    setConfirmation({ isOpen: false, message: "", onConfirm: () => {} });
  };

  // Game logic handlers (create, join, reset, etc.)
  // ... (You will put your handler functions here, possibly refactored into hooks or utils) ...

  // Render logic
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
        <div className="text-xl font-semibold animate-pulse">Loading game...</div>
      </div>
    );
  }

  let contentToRender;
  if (!gameId) {
    contentToRender = (
      <LandingPage
        onCreateGame={/* handler */}
        onJoinGame={/* handler */}
      />
    );
  } else if (gameDetails?.gamePhase === "reveal") {
    contentToRender = (
      <RevealScreen handleFinishGame={isHost ? /* handler */ : null} />
    );
  } else if (gameDetails?.gamePhase === "voting") {
    contentToRender = isHost ? (
      <HostVotingDashboard />
    ) : (
      <VotingScreen />
    );
  } else if (isHost) {
    contentToRender = (
      <HostDashboard
        gameDetails={gameDetails}
        handleResetGame={/* handler */}
        showConfirmation={showConfirmation}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
      />
    );
  } else if (characterId) {
    contentToRender = (
      <PlayerDashboard
        gameDetails={gameDetails}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
      />
    );
  } else {
    contentToRender = <WaitingForAssignmentScreen gameDetails={gameDetails} />;
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userId,
        isHost,
        gameId,
        characterId,
        showModalMessage,
        showConfirmation,
        addNotification,
        unreadPublicCount,
        setUnreadPublicCount,
        unreadPrivateChats,
        setUnreadPrivateChats,
      }}
    >
      <GameContext.Provider value={{ gameDetails, clueStates, playersInGame }}>
        <ScriptLoader />
        <div
          className="min-h-screen bg-cover bg-center bg-fixed"
          style={{
            backgroundImage:
              "url('https://static.vecteezy.com/system/resources/thumbnails/023/602/482/small_2x/silhouette-of-man-in-old-fashioned-hat-and-coat-at-night-street-generative-ai-photo.jpg')",
          }}
        >
          <div className="min-h-screen w-full bg-black/60 backdrop-blur-sm flex flex-col items-center p-2 sm:p-4 font-lato text-zinc-100">
            <NotificationContainer notifications={notifications} />
            <img
              src="https://upload.wikimedia.org/wikipedia/fr/d/da/Murder_Mystery.png"
              alt="Murder Mystery Logo"
              className="w-full max-w-[280px] sm:max-w-xs md:max-w-sm mb-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
            />
            {userId && (
              <div className="bg-black/30 text-zinc-300 p-2 rounded-md mb-4 text-xs sm:text-sm shadow-inner">
                Your User ID:{" "}
                <span className="font-mono text-red-400">{userId}</span>
              </div>
            )}
            {contentToRender}
          </div>
          {showModal && <Modal message={modalContent} onClose={closeModal} />}
          {confirmation.isOpen && (
            <ConfirmationModal
              message={confirmation.message}
              onConfirm={confirmation.onConfirm}
              onCancel={closeConfirmation}
            />
          )}
        </div>
      </GameContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;