"use client";

import React, { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  ArrowDownLeft, 
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import RevenueAnalytics from './RevenueAnalytics';
import MemberAnalytics from './MemberAnalytics';
import TransferAnalytics from './TransferAnalytics';

type AnalyticsTab = 'overview' | 'revenue' | 'members' | 'transfers';

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const tabs = [
    {
      id: 'overview' as const,
      name: 'Overview',
      icon: BarChart3,
      description: 'Key metrics and insights'
    },
    {
      id: 'revenue' as const,
      name: 'Revenue',
      icon: DollarSign,
      description: 'Financial performance'
    },
    {
      id: 'members' as const,
      name: 'Members',
      icon: Users,
      description: 'Community growth'
    },
    {
      id: 'transfers' as const,
      name: 'Transfers',
      icon: ArrowDownLeft,
      description: 'Payout analytics'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'revenue':
        return <RevenueAnalytics />;
      case 'members':
        return <MemberAnalytics />;
      case 'transfers':
        return <TransferAnalytics />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor your community's performance and growth</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {renderTabContent()}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">₹45,230</div>
          <div className="text-sm text-gray-600">Total Revenue</div>
          <div className="text-xs text-green-600 mt-1">+12.5% from last month</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">1,247</div>
          <div className="text-sm text-gray-600">Total Members</div>
          <div className="text-xs text-green-600 mt-1">+8.3% from last month</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Excellent</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">94.2%</div>
          <div className="text-sm text-gray-600">Engagement Rate</div>
          <div className="text-xs text-green-600 mt-1">+2.1% from last month</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ArrowDownLeft className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">99.1%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">₹42,180</div>
          <div className="text-sm text-gray-600">Payouts Received</div>
          <div className="text-xs text-gray-600 mt-1">Success rate: 99.1%</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <span className="text-sm text-gray-500">Last 7 days</span>
          </div>
          
          <div className="space-y-4">
            {[
              { day: 'Mon', amount: 4200, growth: 12 },
              { day: 'Tue', amount: 3800, growth: -8 },
              { day: 'Wed', amount: 5100, growth: 24 },
              { day: 'Thu', amount: 4600, growth: 8 },
              { day: 'Fri', amount: 6200, growth: 35 },
              { day: 'Sat', amount: 5800, growth: 18 },
              { day: 'Sun', amount: 4100, growth: -12 }
            ].map((data, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 w-8">{data.day}</span>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(data.amount / 6200) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-16 text-right">
                  ₹{(data.amount / 100).toLocaleString()}
                </span>
                <span className={`text-xs w-12 text-right ${
                  data.growth >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.growth >= 0 ? '+' : ''}{data.growth}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Member Growth */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Member Growth</h3>
            <span className="text-sm text-gray-500">Last 7 days</span>
          </div>
          
          <div className="space-y-4">
            {[
              { day: 'Mon', new: 12, active: 890 },
              { day: 'Tue', new: 8, active: 920 },
              { day: 'Wed', new: 15, active: 945 },
              { day: 'Thu', new: 11, active: 960 },
              { day: 'Fri', new: 18, active: 980 },
              { day: 'Sat', new: 14, active: 995 },
              { day: 'Sun', new: 9, active: 1005 }
            ].map((data, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 w-8">{data.day}</span>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(data.new / 18) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-12 text-right">
                  +{data.new}
                </span>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {data.active} active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-2">↗️ 12.5%</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Revenue Growth</div>
            <div className="text-xs text-gray-600">Your revenue is growing faster than 78% of communities</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">🎯 94.2%</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Engagement Rate</div>
            <div className="text-xs text-gray-600">Excellent member engagement - keep up the great content!</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-2">⚡ 99.1%</div>
            <div className="text-sm font-medium text-gray-900 mb-1">Transfer Success</div>
            <div className="text-xs text-gray-600">Your payouts are processing reliably and quickly</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50">
            <Users className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <div className="font-medium text-gray-900">View Member Details</div>
              <div className="text-sm text-gray-600">See detailed member analytics</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Revenue Breakdown</div>
              <div className="text-sm text-gray-600">Analyze revenue sources</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50">
            <ArrowDownLeft className="w-5 h-5 text-purple-600" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Transfer History</div>
              <div className="text-sm text-gray-600">View payout details</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
