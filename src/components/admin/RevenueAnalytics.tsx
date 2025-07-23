"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Target,
  Clock
} from 'lucide-react';

interface IRevenueMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  averageRevenuePerUser: number;
  totalSubscribers: number;
  activeSubscribers: number;
  churnRate: number;
  conversionRate: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  lifetimeValue: number;
  payoutReceived: number;
  pendingPayouts: number;
  platformFeePaid: number;
}

interface IRevenueChart {
  period: string;
  revenue: number;
  subscribers: number;
  payouts: number;
  growth: number;
}

interface IRevenueForecast {
  month: string;
  projected: number;
  conservative: number;
  optimistic: number;
}

export default function RevenueAnalytics() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<IRevenueMetrics | null>(null);
  const [chartData, setChartData] = useState<IRevenueChart[]>([]);
  const [forecast, setForecast] = useState<IRevenueForecast[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchRevenueData();
    }
  }, [session, timeRange]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics/revenue?timeRange=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setChartData(data.chartData || []);
        setForecast(data.forecast || []);
      }
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
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

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <ArrowUpRight className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDownRight className="w-4 h-4 text-red-500" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Revenue Data</h3>
        <p className="text-gray-600">Start accepting payments to see your revenue analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
          <p className="text-gray-600">Track your community's financial performance</p>
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
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            {getGrowthIcon(metrics.revenueGrowth)}
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Total Revenue</span>
            <span className={`text-sm font-medium ${getGrowthColor(metrics.revenueGrowth)}`}>
              {formatPercentage(metrics.revenueGrowth)}
            </span>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(metrics.monthlyRevenue)}
          </div>
          <div className="text-sm text-gray-600">This Month</div>
        </div>

        {/* Active Subscribers */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {formatPercentage(100 - metrics.churnRate)} retention
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.activeSubscribers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Active Subscribers</div>
        </div>

        {/* Average Revenue Per User */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Target className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              ARPU
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(metrics.averageRevenuePerUser)}
          </div>
          <div className="text-sm text-gray-600">Per User</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Payouts</span>
            </div>
          </div>
        </div>
        
        {/* Simple Chart Visualization */}
        <div className="space-y-4">
          {chartData.slice(-7).map((data, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-16 text-sm text-gray-600">{data.period}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((data.revenue / Math.max(...chartData.map(d => d.revenue))) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="w-20 text-sm text-gray-900 text-right">
                  {formatCurrency(data.revenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Breakdown</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Gross Revenue</span>
              <span className="font-medium">{formatCurrency(metrics.totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Platform Fees</span>
              <span className="font-medium text-red-600">-{formatCurrency(metrics.platformFeePaid)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="font-semibold text-gray-900">Net Revenue</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(metrics.payoutReceived)}
              </span>
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Metrics</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Monthly Recurring Revenue</span>
              <span className="font-medium">{formatCurrency(metrics.monthlyRecurringRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Annual Recurring Revenue</span>
              <span className="font-medium">{formatCurrency(metrics.annualRecurringRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Customer Lifetime Value</span>
              <span className="font-medium">{formatCurrency(metrics.lifetimeValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Conversion Rate</span>
              <span className="font-medium">{metrics.conversionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Churn Rate</span>
              <span className={`font-medium ${metrics.churnRate > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.churnRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Forecast */}
      {forecast.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Revenue Forecast</h3>
            <span className="text-sm text-gray-500">(Next 3 months)</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecast.slice(0, 3).map((month, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">{month.month}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conservative</span>
                    <span className="text-gray-900">{formatCurrency(month.conservative)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Projected</span>
                    <span className="font-medium text-blue-600">{formatCurrency(month.projected)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Optimistic</span>
                    <span className="text-green-600">{formatCurrency(month.optimistic)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Payouts */}
      {metrics.pendingPayouts > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-900">Pending Payouts</h4>
              <p className="text-sm text-yellow-700">
                You have {formatCurrency(metrics.pendingPayouts)} in pending payouts that will be transferred soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
