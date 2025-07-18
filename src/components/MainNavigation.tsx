"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";
import ProfileAvatar from "./ProfileAvatar";

export default function MainNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const navItems = [
    { href: "/community", label: "Community" },
    { href: "/courses", label: "Courses" },
    { href: "/calendar", label: "Calendar" },
    { href: "/about", label: "About" },
    { href: "/members", label: "Members" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="w-full border-b border-base-300 bg-base-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center">
                <div className="bg-primary text-primary-content font-bold text-sm h-8 w-8 flex items-center justify-center rounded mr-2">
                  R/B
                </div>
                <span className="font-semibold text-base-content">reset your brain</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-2">
              {navItems.map((item) => {
                const isActive = 
                  (item.href === "/settings" && pathname.startsWith("/settings")) ||
                  pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 h-full ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent hover:text-base-content/70 hover:border-base-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {session?.user ? (
                <ProfileAvatar
                  imageUrl={session.user.profileImage || session.user.image}
                  name={session.user.name || session.user.username}
                  email={session.user.email}
                  size="sm"
                  className="w-8 h-8"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                  <User className="w-4 h-4 text-base-content/60" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
