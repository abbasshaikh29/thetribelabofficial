"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Calendar,
  Clock,
  Star,
  MessageCircle,
  Eye,
  Heart,
  Share2
} from 'lucide-react';

interface IMemberMetrics {
  totalMembers: number;
  activeMembers: number;
  newMembersThisMonth: number;
  memberGrowthRate: number;
  churnRate: number;
  retentionRate: number;
  averageSessionDuration: number;
  engagementRate: number;
  topPerformingContent: any[];
  membersByPlan: { planName: string; count: number; percentage: number }[];
  memberActivity: { date: string; newMembers: number; activeMembers: number; churnedMembers: number }[];
}

interface IMemberSegment {
  name: string;
  count: number;
  percentage: number;
  growth: number;
  color: string;
}

export default function MemberAnalytics() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<IMemberMetrics | null>(null);
  const [segments, setSegments] = useState<IMemberSegment[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchMemberData();
    }
  }, [session, timeRange]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics/members?timeRange=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setSegments(data.segments || []);
      }
    } catch (error) {
      console.error('Failed to fetch member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
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
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Member Data</h3>
        <p className="text-gray-600">Start building your community to see member analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Member Analytics</h2>
          <p className="text-gray-600">Track your community growth and engagement</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-lg ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Members */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            {getGrowthIcon(metrics.memberGrowthRate)}
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.totalMembers.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Total Members</span>
            <span className={`text-sm font-medium ${getGrowthColor(metrics.memberGrowthRate)}`}>
              {formatPercentage(metrics.memberGrowthRate)}
            </span>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {((metrics.activeMembers / metrics.totalMembers) * 100).toFixed(0)}% active
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.activeMembers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Active Members</div>
        </div>

        {/* New Members */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-600" />
            </div>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.newMembersThisMonth.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">New This Month</div>
        </div>

        {/* Retention Rate */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Heart className="w-5 h-5 text-yellow-600" />
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              metrics.retentionRate >= 80 ? 'bg-green-100 text-green-800' :
              metrics.retentionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {metrics.retentionRate >= 80 ? 'Excellent' :
               metrics.retentionRate >= 60 ? 'Good' : 'Needs Work'}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.retentionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Retention Rate</div>
        </div>
      </div>

      {/* Member Growth Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Member Growth</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">New Members</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Active Members</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-600">Churned</span>
            </div>
          </div>
        </div>
        
        {/* Simple Chart Visualization */}
        <div className="space-y-4">
          {metrics.memberActivity.slice(-7).map((data, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-16 text-sm text-gray-600">{data.date}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
                  <div 
                    className="bg-green-500 h-2 rounded-full absolute"
                    style={{ width: `${Math.min((data.newMembers / 10) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="w-16 text-sm text-gray-900 text-right">
                  +{data.newMembers}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member Segments and Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Segments */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Member Segments</h3>
          
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  ></div>
                  <span className="text-gray-900">{segment.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{segment.count}</span>
                  <span className="text-sm text-gray-500">({segment.percentage.toFixed(1)}%)</span>
                  <span className={`text-sm font-medium ${getGrowthColor(segment.growth)}`}>
                    {formatPercentage(segment.growth)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Engagement Metrics</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">Engagement Rate</span>
              </div>
              <span className="font-medium">{metrics.engagementRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">Avg. Session Duration</span>
              </div>
              <span className="font-medium">{formatDuration(metrics.averageSessionDuration)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserMinus className="w-4 h-4 text-red-600" />
                <span className="text-gray-600">Churn Rate</span>
              </div>
              <span className="font-medium">{metrics.churnRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600" />
                <span className="text-gray-600">Active Discussions</span>
              </div>
              <span className="font-medium">
                {Math.round(metrics.activeMembers * 0.3)} {/* Placeholder */}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Members by Plan */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Members by Plan</h3>
        
        <div className="space-y-4">
          {metrics.membersByPlan.map((plan, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Star className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">{plan.planName}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2 w-32">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${plan.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">{plan.count}</span>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {plan.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performing Content */}
      {metrics.topPerformingContent.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Content</h3>
          
          <div className="space-y-4">
            {metrics.topPerformingContent.slice(0, 5).map((content, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-purple-600">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{content.title}</div>
                    <div className="text-sm text-gray-600">{content.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {content.views}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {content.likes}
                  </div>
                  <div className="flex items-center gap-1">
                    <Share2 className="w-4 h-4" />
                    {content.shares}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
