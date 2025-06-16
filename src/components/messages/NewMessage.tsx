"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotification } from "../Notification";
import { ArrowLeft, Search, Loader2 } from "lucide-react";

interface User {
  _id: string;
  username: string;
  profileImage?: string;
}

interface NewMessageProps {
  onBack: () => void;
  onSelectUser: (userId: string) => void;
  onMessageSent: () => void;
}

export default function NewMessage({
  onBack,
  onSelectUser,
  onMessageSent,
}: NewMessageProps) {
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
        showNotification("Failed to load users", "error");
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchUsers();
    }
  }, [session]);

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-base-300 flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="btn btn-ghost btn-sm btn-circle mr-2"
          title="Go back"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="font-medium">New Message</span>
      </div>

      <div className="p-3 border-b border-base-300">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="input input-bordered input-sm w-full pl-9"
          />
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
          />
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No users found</p>
          </div>
        ) : (
          <div>
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                className="flex items-center p-3 hover:bg-base-200 cursor-pointer border-b border-base-200"
                onClick={() => onSelectUser(user._id)}
              >
                <div className="avatar mr-3">
                  <div className="w-10 h-10 rounded-full">
                    {user.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt={user.username}
                        className="object-cover w-full h-full rounded-full"
                      />
                    ) : (
                      <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full rounded-full">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{user.username}</h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
