"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouteAccountSetup from '@/components/admin/RouteAccountSetup';
import RouteAccountStatus from '@/components/admin/RouteAccountStatus';

export default function RouteAccountSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showSetup, setShowSetup] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    checkAccountStatus();
  }, [session, status]);

  const checkAccountStatus = async () => {
    try {
      const response = await fetch('/api/admin/route-account/status');
      if (response.ok) {
        const data = await response.json();
        const hasAccount = data.status.status !== 'not_created';
        setAccountExists(hasAccount);
        setShowSetup(!hasAccount);
      }
    } catch (error) {
      console.error('Failed to check account status:', error);
      setShowSetup(true); // Default to showing setup if check fails
    } finally {
      setLoading(false);
    }
  };

  const handleSetupClick = () => {
    setShowSetup(true);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {showSetup ? (
          <RouteAccountSetup />
        ) : (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Account</h1>
              <p className="text-gray-600">
                Manage your Route account for receiving payments from community members
              </p>
            </div>
            
            <RouteAccountStatus 
              onSetupClick={handleSetupClick}
              showSetupButton={!accountExists}
            />
          </div>
        )}
      </div>
    </div>
  );
}
