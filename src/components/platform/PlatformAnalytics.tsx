"use client";

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Building2,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Globe,
  Zap
} from 'lucide-react';

interface IPlatformMetrics {
  totalRevenue: number;
  platformFees: number;
  totalCommunities: number;
  activeCommunities: number;
  totalMembers: number;
  activeMembers: number;
  totalTransfers: number;
  successfulTransfers: number;
  averageTransferTime: number;
  topPerformingCommunities: any[];
  revenueGrowth: number;
  memberGrowth: number;
  communityGrowth: number;
  systemHealth: number;
}

interface IPlatformTrend {
  date: string;
  revenue: number;
  communities: number;
  members: number;
  transfers: number;
}

export default function PlatformAnalytics() {
  const [metrics, setMetrics] = useState<IPlatformMetrics | null>(null);
  const [trends, setTrends] = useState<IPlatformTrend[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformData();
  }, [timeRange]);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/platform/analytics?timeRange=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error('Failed to fetch platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toLocaleString('en-IN')}`;
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getHealthColor = (health: number) => {
    if (health >= 95) return 'text-green-600';
    if (health >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthStatus = (health: number) => {
    if (health >= 95) return 'Excellent';
    if (health >= 85) return 'Good';
    if (health >= 70) return 'Fair';
    return 'Needs Attention';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Platform Data</h3>
        <p className="text-gray-600">Platform analytics will appear here once communities are active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Platform Analytics</h2>
          <p className="text-gray-600">Monitor platform-wide performance and growth</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-lg ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 Days' : 
               range === '30d' ? '30 Days' : 
               range === '90d' ? '90 Days' : 
               '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Platform Revenue */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(metrics.platformFees)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Platform Revenue</span>
            <span className={`text-sm font-medium ${getGrowthColor(metrics.revenueGrowth)}`}>
              {formatPercentage(metrics.revenueGrowth)}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Total GMV: {formatCurrency(metrics.totalRevenue)}
          </div>
        </div>

        {/* Total Communities */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {((metrics.activeCommunities / metrics.totalCommunities) * 100).toFixed(0)}% active
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.totalCommunities.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Communities</span>
            <span className={`text-sm font-medium ${getGrowthColor(metrics.communityGrowth)}`}>
              {formatPercentage(metrics.communityGrowth)}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.activeCommunities} active
          </div>
        </div>

        {/* Total Members */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.totalMembers.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Total Members</span>
            <span className={`text-sm font-medium ${getGrowthColor(metrics.memberGrowth)}`}>
              {formatPercentage(metrics.memberGrowth)}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.activeMembers} active
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              metrics.systemHealth >= 95 ? 'bg-green-100 text-green-800' :
              metrics.systemHealth >= 85 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {getHealthStatus(metrics.systemHealth)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.systemHealth.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">System Health</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.successfulTransfers}/{metrics.totalTransfers} transfers
          </div>
        </div>
      </div>

      {/* Platform Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Platform Growth</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Communities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-gray-600">Members</span>
            </div>
          </div>
        </div>
        
        {/* Simple Chart Visualization */}
        <div className="space-y-4">
          {trends.slice(-7).map((trend, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-16 text-sm text-gray-600">{trend.date}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min((trend.revenue / Math.max(...trends.map(t => t.revenue))) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="w-20 text-sm text-gray-900 text-right">
                  {formatCurrency(trend.revenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics and Top Communities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Metrics</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">Transfer Success Rate</span>
              </div>
              <span className="font-medium">
                {((metrics.successfulTransfers / metrics.totalTransfers) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">Avg Transfer Time</span>
              </div>
              <span className="font-medium">
                {metrics.averageTransferTime < 60 
                  ? `${Math.round(metrics.averageTransferTime)}m`
                  : `${Math.round(metrics.averageTransferTime / 60)}h`
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <span className="text-gray-600">Community Engagement</span>
              </div>
              <span className="font-medium">
                {((metrics.activeMembers / metrics.totalMembers) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">Revenue per Community</span>
              </div>
              <span className="font-medium">
                {formatCurrency(Math.round(metrics.totalRevenue / metrics.totalCommunities))}
              </span>
            </div>
          </div>
        </div>

        {/* Top Performing Communities */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Communities</h3>
          
          <div className="space-y-4">
            {metrics.topPerformingCommunities.slice(0, 5).map((community, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{community.name}</div>
                    <div className="text-sm text-gray-600">{community.members} members</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(community.revenue)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {community.growth >= 0 ? '+' : ''}{community.growth.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">System Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">
              {metrics.successfulTransfers}
            </div>
            <div className="text-sm text-gray-600">Successful Transfers</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">
              {metrics.totalTransfers - metrics.successfulTransfers}
            </div>
            <div className="text-sm text-gray-600">Pending/Processing</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">
              {metrics.activeCommunities}
            </div>
            <div className="text-sm text-gray-600">Active Communities</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">
              {metrics.systemHealth.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">System Health</div>
          </div>
        </div>
      </div>
    </div>
  );
}
