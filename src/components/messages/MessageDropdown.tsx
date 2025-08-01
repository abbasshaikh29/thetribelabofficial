"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "../Notification";
import { User, MessageCircle, Search, Plus } from "lucide-react";
import Link from "next/link";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import MessageModal from "./MessageModal";
import NewMessage from "./NewMessage";

interface Conversation {
  _id: string;
  participants: {
    _id: string;
    username: string;
    profileImage?: string;
  }[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCounts: {
    userId: string;
    count: number;
  }[];
}

interface MessageDropdownProps {
  onClose: () => void;
  onSelectConversation?: (userId: string) => void;
}

export default function MessageDropdown({
  onClose,
  onSelectConversation,
}: MessageDropdownProps) {
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchConversations();
    }

    // Refresh conversations every 30 seconds when dropdown is open
    const intervalId = setInterval(() => {
      if (session?.user?.id) {
        fetchConversations();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [session]);

  const handleSelectConversation = (userId: string) => {
    if (onSelectConversation) {
      // If parent component provided a handler, use it
      onSelectConversation(userId);
    } else {
      // Otherwise use internal state
      setSelectedConversation(userId);
      setShowNewMessage(false);
      setShowModal(true);
      // Close the dropdown when opening the modal
      onClose();
    }
  };

  const handleNewMessage = () => {
    setSelectedConversation(null);
    setShowNewMessage(true);
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setShowNewMessage(false);
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/messages");
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      showNotification("Failed to load conversations", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMessageSent = () => {
    // Refresh conversations after sending a message
    fetchConversations();
  };

  return (
    <div 
      className="dropdown-content z-[1] shadow-lg rounded-box w-80 sm:w-96 mt-4 overflow-hidden absolute right-0" 
      style={{ 
        backgroundColor: "var(--dropdown-bg)", 
        borderColor: "var(--border-color)",
        opacity: "1",
        backdropFilter: "none",
        border: "1px solid var(--border-color)"
      }}
    >
      <div className="flex flex-col">
        <div className="p-3 border-b border-base-300 flex justify-between items-center">
          <h3 className="font-semibold">Messages</h3>
          <button
            type="button"
            onClick={handleNewMessage}
            className="btn btn-ghost btn-sm btn-circle"
            title="New message"
          >
            <Plus size={18} />
          </button>
        </div>

        {showNewMessage ? (
          <NewMessage
            onBack={handleBack}
            onSelectUser={handleSelectConversation}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            loading={loading}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </div>
    </div>
  );
}
