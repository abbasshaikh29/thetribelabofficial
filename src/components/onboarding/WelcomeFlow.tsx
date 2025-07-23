"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Users, 
  DollarSign,
  Settings,
  AlertCircle
} from 'lucide-react';

interface ITrialStatus {
  isActive: boolean;
  daysRemaining: number;
  percentRemaining: number;
  endDate: Date | null;
  isExpired: boolean;
  isInGracePeriod: boolean;
  canCreateCommunities: boolean;
  canReceivePayments: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

interface ITrialNotification {
  type: string;
  daysRemaining: number;
  message: string;
  actionRequired: boolean;
  urgencyLevel: 'info' | 'warning' | 'error';
}

interface WelcomeFlowProps {
  onComplete?: () => void;
  showTrialStatus?: boolean;
}

export default function WelcomeFlow({ onComplete, showTrialStatus = true }: WelcomeFlowProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [trialStatus, setTrialStatus] = useState<ITrialStatus | null>(null);
  const [notification, setNotification] = useState<ITrialNotification | null>(null);
  const [loading, setLoading] = useState(true);

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to TheTribeLab!',
      description: 'Your community management platform is ready',
      icon: Sparkles,
      color: 'text-blue-600'
    },
    {
      id: 'trial',
      title: '14-Day Free Trial Started',
      description: 'Explore all features with no limitations',
      icon: Clock,
      color: 'text-green-600'
    },
    {
      id: 'community',
      title: 'Create Your First Community',
      description: 'Start building your community today',
      icon: Users,
      color: 'text-purple-600'
    },
    {
      id: 'payments',
      title: 'Set Up Payments (Optional)',
      description: 'Enable payments to monetize your community',
      icon: DollarSign,
      color: 'text-yellow-600'
    }
  ];

  useEffect(() => {
    fetchTrialStatus();
  }, []);

  const fetchTrialStatus = async () => {
    try {
      const response = await fetch('/api/admin/trial-status');
      if (response.ok) {
        const data = await response.json();
        setTrialStatus(data.trialStatus);
        setNotification(data.notification);
      }
    } catch (error) {
      console.error('Failed to fetch trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    } else {
      router.push('/dashboard');
    }
  };

  const handleCreateCommunity = () => {
    router.push('/create-community');
  };

  const handleSetupPayments = () => {
    router.push('/admin/route-account-setup');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Trial Status Banner */}
        {showTrialStatus && trialStatus && notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.urgencyLevel === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800'
              : notification.urgencyLevel === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6`}>
            <Icon className={`w-8 h-8 ${currentStepData.color}`} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {currentStepData.title}
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            {currentStepData.description}
          </p>

          {/* Step-specific content */}
          {currentStep === 0 && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Account created successfully</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>14-day free trial activated</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Platform subscription ready</span>
              </div>
            </div>
          )}

          {currentStep === 1 && trialStatus && (
            <div className="space-y-4 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-green-800">Trial Active</span>
                  <span className="text-sm text-green-600">
                    {trialStatus.daysRemaining} days remaining
                  </span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${trialStatus.percentRemaining}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Enjoy unlimited access to all features during your trial period.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 mb-8">
              <p className="text-gray-600">
                Create your first community to start building your audience and engaging with members.
              </p>
              <button
                onClick={handleCreateCommunity}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Users className="w-5 h-5" />
                Create Community Now
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 mb-8">
              <p className="text-gray-600">
                Set up payment processing to monetize your community. You can skip this step and set it up later.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleSetupPayments}
                  className="inline-flex items-center gap-2 bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <DollarSign className="w-5 h-5" />
                  Set Up Payments
                </button>
                <button
                  onClick={handleSkip}
                  className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip Welcome
            </button>

            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Need help? Check out our{' '}
            <a href="/docs" className="text-blue-600 hover:underline">
              documentation
            </a>{' '}
            or{' '}
            <a href="/support" className="text-blue-600 hover:underline">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
