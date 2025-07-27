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
} from "firebase/firestore";

function PrivateChat() {
  const {
    userId,
    isHost,
    gameId,
    characterId,
    showModalMessage,
    setUnreadPrivateChats,
  } = useContext(AuthContext);
  const { playersInGame, gameDetails } = useContext(GameContext);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  const [mobileView, setMobileView] = useState("list");

  const generateChatId = (id1, id2) => [id1, id2].sort().join("_");

  useEffect(() => {
    if (selectedChat) {
      const chatId = isHost ? selectedChat : generateChatId(characterId, selectedChat);
      const messagesColRef = collection(
        db,
        `artifacts/default-app-id/public/data/games/${gameId}/privateChats/${chatId}/messages`
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
  }, [selectedChat, gameId, characterId, isHost]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    const chatId = generateChatId(characterId, selectedChat);
    const messagesColRef = collection(
      db,
      `artifacts/default-app-id/public/data/games/${gameId}/privateChats/${chatId}/messages`
    );
    try {
      await addDoc(messagesColRef, {
        text: newMessage,
        senderId: characterId,
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      showModalMessage("Failed to send message.");
    }
  };

  const handleSelectChat = (chatIdentifier) => {
    const chatId = isHost ? chatIdentifier : generateChatId(characterId, chatIdentifier);
    setSelectedChat(chatIdentifier);
    setMobileView("chat");
    setUnreadPrivateChats((prev) => {
      const newCounts = { ...prev };
      if (newCounts[chatId] > 0) {
        newCounts[chatId] = 0;
      }
      return newCounts;
    });
  };

  const otherPlayers = playersInGame.filter(
    (p) => p.characterId && p.characterId !== characterId
  );

  const allChatPairs = playersInGame.reduce((pairs, p1) => {
    playersInGame.forEach((p2) => {
      if (p1.characterId && p2.characterId && p1.characterId < p2.characterId) {
        const chatId = generateChatId(p1.characterId, p2.characterId);
        if (!pairs.some((p) => p.chatId === chatId)) {
          pairs.push({ chatId, p1, p2 });
        }
      }
    });
    return pairs;
  }, []);

  if (isHost) {
    return (
      <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
        <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">
          Private Conversations
        </h3>
        <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
          <div
            className={`w-full md:w-1/3 border-zinc-700 pr-0 md:pr-4 overflow-y-auto ${
              mobileView === "chat" && selectedChat ? "hidden md:block" : "block"
            }`}
          >
            <h4 className="text-lg font-bold text-zinc-300 mb-2">
              Select a Conversation:
            </h4>
            {allChatPairs.map(({ chatId, p1, p2 }) => {
              const char1 = gameDetails.characters[p1.characterId];
              const char2 = gameDetails.characters[p2.characterId];
              if (!char1 || !char2) return null;
              return (
                <button
                  key={chatId}
                  onClick={() => handleSelectChat(chatId)}
                  className={`w-full text-left p-2 rounded-md mb-1 ${
                    selectedChat === chatId
                      ? "bg-red-800/80"
                      : "bg-zinc-800/80 hover:bg-zinc-700/80"
                  }`}
                >
                  {char1.name} & {char2.name}
                </button>
              );
            })}
          </div>
          <div
            className={`w-full md:w-2/3 flex flex-col ${
              mobileView === "list" || !selectedChat ? "hidden md:flex" : "flex"
            }`}
          >
            {selectedChat ? (
              <>
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden bg-zinc-700 text-white py-1 px-3 rounded-md mb-2 self-start"
                >
                  ← Back
                </button>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                  {messages.map((msg) => {
                    const sender = gameDetails.characters[msg.senderId];
                    return (
                      <div key={msg.id} className={`flex items-start gap-3`}>
                        {sender?.idpic && (
                          <img
                            src={`https://images.weserv.nl/?url=${encodeURIComponent(sender.idpic)}&w=40&h=40&fit=cover&a=top`}
                            alt={sender.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-zinc-600"
                          />
                        )}
                        <div className="flex-1 p-3 rounded-lg bg-zinc-800/80">
                          <p className="font-bold text-red-300">{sender?.name || "Unknown"}</p>
                          <p className="text-zinc-100 whitespace-pre-wrap mt-1">{msg.text}</p>
                          <p className="text-xs text-zinc-500 text-right mt-1">
                            {msg.timestamp?.toDate().toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Select a conversation to view messages.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/30 p-2 sm:p-4 rounded-lg shadow-lg border border-zinc-700/50 flex flex-col h-[60vh] md:h-[70vh]">
      <h3 className="text-xl sm:text-2xl font-playfair-display font-bold text-red-500 mb-4 text-center">
        Private Chat
      </h3>
      <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
        <div
          className={`w-full md:w-1/3 md:border-r border-zinc-700 pr-0 md:pr-4 overflow-y-auto ${
            mobileView === "chat" ? "hidden md:block" : "block"
          }`}
        >
          <h4 className="text-lg font-bold text-zinc-300 mb-2">Chat With:</h4>
          {otherPlayers.map((player) => {
            const character = gameDetails.characters[player.characterId];
            return (
              <button
                key={player.id}
                onClick={() => handleSelectChat(player.characterId)}
                className={`w-full text-left p-2 rounded-md mb-1 flex items-center gap-2 ${
                  selectedChat === player.characterId
                    ? "bg-red-800/80"
                    : "bg-zinc-800/80 hover:bg-zinc-700/80"
                }`}
              >
                <img
                  src={`https://images.weserv.nl/?url=${encodeURIComponent(character.idpic)}&w=32&h=32&fit=cover&a=top`}
                  alt={character.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span>{character.name}</span>
              </button>
            );
          })}
        </div>
        <div
          className={`w-full md:w-2/3 flex flex-col ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedChat ? (
            <>
              <div className="flex items-center mb-2">
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden bg-zinc-700 text-white py-1 px-3 rounded-md mr-2"
                >
                  ← Back
                </button>
                <h4 className="text-lg font-bold text-zinc-100">
                  Chat with {gameDetails.characters[selectedChat]?.name}
                </h4>
              </div>
              <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {messages.map((msg) => {
                  const isMyMessage = msg.senderId === characterId;
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
                        <p className="text-zinc-100 whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-xs text-zinc-500 text-right mt-1">
                          {msg.timestamp?.toDate().toLocaleTimeString()}
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
                  placeholder={`Message ${gameDetails.characters[selectedChat]?.name}...`}
                  className="flex-grow p-3 bg-zinc-900/80 text-zinc-100 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 border border-zinc-700"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:from-red-700 hover:to-red-900 transition"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              Select a player to start a conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrivateChat;