import React, { useState, useEffect, useRef, useContext } from "react";
import AuthContext from "../context/AuthContext";
import GameContext from "../context/GameContext";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
} from "firebase/firestore";

function PublicBoard() {
  const {
    userId,
    isHost,
    gameId,
    characterId,
    showConfirmation,
    showModalMessage,
  } = useContext(AuthContext);
  const { playersInGame, gameDetails } = useContext(GameContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (gameId) {
      const messagesColRef = collection(
        db,
        `artifacts/default-app-id/public/data/games/${gameId}/messages`
      );
      const q = query(messagesColRef, orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(fetchedMessages);
      });
      return () => unsubscribe();
    }
  }, [gameId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const myPlayer = playersInGame.find((p) => p.id === userId);
    const senderName = isHost ? "The Host" : myPlayer?.name || "Unknown Player";
    try {
      const messagesColRef = collection(
        db,
        `artifacts/default-app-id/public/data/games/${gameId}/messages`
      );
      await addDoc(messagesColRef, {
        text: newMessage,
        senderId: userId,
        senderName: senderName,
        characterId: characterId,
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      showModalMessage("Failed to send message. Please try again.");
    }
  };

  const handleDeleteMessage = (messageId) => {
    showConfirmation("Are you sure you want to delete this message?", async () => {
      try {
        const messageDocRef = doc(
          db,
          `artifacts/default-app-id/public/data/games/${gameId}/messages/${messageId}`
        );
        await deleteDoc(messageDocRef);
      } catch (error) {
        showModalMessage("Failed to delete message.");
      }
    });
  };

  return (
    <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
      <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">
        Public Message Board
      </h3>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {messages.map((msg) => {
          const isMyMessage = msg.senderId === userId;
          let senderDisplayName;
          if (isMyMessage) {
            senderDisplayName = isHost
              ? "The Host"
              : gameDetails.characters[characterId]?.name || "You";
          } else {
            if (isHost) {
              senderDisplayName =
                gameDetails.characters[msg.characterId]?.name ||
                msg.senderName ||
                "Unknown Player";
            } else {
              senderDisplayName = "A Mysterious Figure";
            }
          }
          return (
            <div
              key={msg.id}
              className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  isMyMessage ? "bg-red-900/70" : "bg-zinc-800/80"
                }`}
              >
                <div className="flex justify-between items-center gap-4">
                  <p className="font-bold text-red-300">{senderDisplayName}</p>
                  {isHost && !isMyMessage && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-xs text-zinc-400 hover:text-red-500"
                    >
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
        <button
          type="submit"
          className="bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:from-red-700 hover:to-red-900 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default PublicBoard;