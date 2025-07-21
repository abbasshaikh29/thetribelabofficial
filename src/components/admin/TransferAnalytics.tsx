"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  ArrowDownLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Zap,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';

interface ITransferMetrics {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  pendingTransfers: number;
  totalAmount: number;
  averageTransferTime: number;
  successRate: number;
  averageTransferAmount: number;
  fastestTransfer: number;
  slowestTransfer: number;
  totalFeesSaved: number;
  batchEfficiency: number;
}

interface ITransferTrend {
  date: string;
  successful: number;
  failed: number;
  amount: number;
  averageTime: number;
}

interface IErrorBreakdown {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

export default function TransferAnalytics() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<ITransferMetrics | null>(null);
  const [trends, setTrends] = useState<ITransferTrend[]>([]);
  const [errorBreakdown, setErrorBreakdown] = useState<IErrorBreakdown[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchTransferData();
    }
  }, [session, timeRange]);

  const fetchTransferData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics/transfers?timeRange=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setTrends(data.trends || []);
        setErrorBreakdown(data.errorBreakdown || []);
      }
    } catch (error) {
      console.error('Failed to fetch transfer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toLocaleString('en-IN')}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPerformanceColor = (rate: number, threshold: number = 95) => {
    if (rate >= threshold) return 'text-green-600';
    if (rate >= threshold - 10) return 'text-yellow-600';
    return 'text-red-600';
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
        <ArrowDownLeft className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transfer Data</h3>
        <p className="text-gray-600">Start receiving payments to see transfer analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transfer Analytics</h2>
          <p className="text-gray-600">Monitor your payout performance and reliability</p>
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
        {/* Success Rate */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              metrics.successRate >= 99 ? 'bg-green-100 text-green-800' :
              metrics.successRate >= 95 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {metrics.successRate >= 99 ? 'Excellent' :
               metrics.successRate >= 95 ? 'Good' : 'Needs Attention'}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.successRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.successfulTransfers}/{metrics.totalTransfers} transfers
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(metrics.totalAmount)}
          </div>
          <div className="text-sm text-gray-600">Total Transferred</div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: {formatCurrency(metrics.averageTransferAmount)}
          </div>
        </div>

        {/* Average Transfer Time */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatDuration(metrics.averageTransferTime)}
          </div>
          <div className="text-sm text-gray-600">Avg Transfer Time</div>
          <div className="text-xs text-gray-500 mt-1">
            Fastest: {formatDuration(metrics.fastestTransfer)}
          </div>
        </div>

        {/* Batch Efficiency */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Saved {formatCurrency(metrics.totalFeesSaved)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.batchEfficiency.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Batch Efficiency</div>
        </div>
      </div>

      {/* Transfer Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Transfer Performance</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Successful</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-600">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Amount</span>
            </div>
          </div>
        </div>
        
        {/* Simple Chart Visualization */}
        <div className="space-y-4">
          {trends.slice(-7).map((trend, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-16 text-sm text-gray-600">{trend.date}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
                  <div 
                    className="bg-green-500 h-2 rounded-full absolute"
                    style={{ width: `${Math.min((trend.successful / Math.max(...trends.map(t => t.successful + t.failed))) * 100, 100)}%` }}
                  ></div>
                  {trend.failed > 0 && (
                    <div 
                      className="bg-red-500 h-2 rounded-full absolute"
                      style={{ 
                        left: `${Math.min((trend.successful / Math.max(...trends.map(t => t.successful + t.failed))) * 100, 100)}%`,
                        width: `${Math.min((trend.failed / Math.max(...trends.map(t => t.successful + t.failed))) * 100, 100)}%`
                      }}
                    ></div>
                  )}
                </div>
                <div className="w-20 text-sm text-gray-900 text-right">
                  {trend.successful + trend.failed}
                </div>
                <div className="w-24 text-sm text-gray-600 text-right">
                  {formatCurrency(trend.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Status and Error Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Status Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Transfer Status</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-gray-900">Successful</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2 w-32">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(metrics.successfulTransfers / metrics.totalTransfers) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {metrics.successfulTransfers}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-gray-900">Failed</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2 w-32">
                  <div 
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(metrics.failedTransfers / metrics.totalTransfers) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {metrics.failedTransfers}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-900">Pending</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2 w-32">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${(metrics.pendingTransfers / metrics.totalTransfers) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {metrics.pendingTransfers}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Error Analysis</h3>
          
          {errorBreakdown.length > 0 ? (
            <div className="space-y-4">
              {errorBreakdown.map((error, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: error.color }}
                    ></div>
                    <span className="text-gray-900">{error.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 w-24">
                      <div 
                        className="h-2 rounded-full"
                        style={{ 
                          backgroundColor: error.color,
                          width: `${error.percentage}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">
                      {error.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No errors in selected period</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatDuration(metrics.fastestTransfer)}
            </div>
            <div className="text-sm text-gray-600">Fastest Transfer</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatDuration(metrics.slowestTransfer)}
            </div>
            <div className="text-sm text-gray-600">Slowest Transfer</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(metrics.totalFeesSaved)}
            </div>
            <div className="text-sm text-gray-600">Fees Saved</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {((metrics.successfulTransfers / metrics.totalTransfers) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Reliability</div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={fetchTransferData}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>
    </div>
  );
}
