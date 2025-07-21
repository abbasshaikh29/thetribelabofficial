import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { CommunityPlan } from "@/models/CommunityPlan";
import { AdminPayout } from "@/models/AdminPayout";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// GET /api/admin/analytics/revenue - Get revenue analytics for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Get admin's communities - Use aggregation to avoid type issues
    const communities = await Community.find([
      { $match: { admin: session.user.id } },
      { $project: { _id: 1, admin: 1 } }
    ]);
    const communityIds = communities.map((c: { _id: mongoose.Types.ObjectId; admin: string }) => c._id);

    if (communityIds.length === 0) {
      return NextResponse.json({
        success: true,
        metrics: getEmptyMetrics(),
        chartData: [],
        forecast: []
      });
    }

    // Get revenue metrics
    const metrics = await calculateRevenueMetrics(session.user.id, communityIds, startDate);
    
    // Get chart data
    const chartData = await getRevenueChartData(communityIds, startDate, timeRange);
    
    // Get revenue forecast
    const forecast = await getRevenueForecast(communityIds, metrics);

    return NextResponse.json({
      success: true,
      metrics,
      chartData,
      forecast
    });

  } catch (error: any) {
    console.error("Revenue analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue analytics" },
      { status: 500 }
    );
  }
}

// Calculate comprehensive revenue metrics
async function calculateRevenueMetrics(adminId: any, communityIds: any[], startDate: Date) {
  try {
    // Get all transactions for admin's communities
    const transactions = await Transaction.aggregate([
      {
        $match: {
          communityId: { $in: communityIds },
          status: 'captured',
          paymentType: 'community_subscription',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          totalPlatformFees: { $sum: '$feeBreakdown.platformFeeAmount' },
          totalProcessingFees: { $sum: '$feeBreakdown.processingFeeAmount' },
          totalAdminEarnings: { $sum: '$feeBreakdown.adminEarnings' }
        }
      }
    ]);

    // Get monthly revenue (current month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyTransactions = await Transaction.aggregate([
      {
        $match: {
          communityId: { $in: communityIds },
          status: 'captured',
          paymentType: 'community_subscription',
          createdAt: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          monthlyRevenue: { $sum: '$amount' },
          monthlyTransactions: { $sum: 1 }
        }
      }
    ]);

    // Get previous month for growth calculation
    const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    const prevMonthTransactions = await Transaction.aggregate([
      {
        $match: {
          communityId: { $in: communityIds },
          status: 'captured',
          paymentType: 'community_subscription',
          createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          prevMonthRevenue: { $sum: '$amount' }
        }
      }
    ]);

    // Get subscriber metrics
    const subscriberMetrics = await CommunityPlan.aggregate([
      {
        $match: {
          communityId: { $in: communityIds }
        }
      },
      {
        $group: {
          _id: null,
          totalSubscribers: { $sum: '$totalSubscribers' },
          totalPlanRevenue: { $sum: '$totalRevenue' },
          averageConversion: { $avg: '$conversionRate' }
        }
      }
    ]);

    // Get payout information
    const payoutMetrics = await AdminPayout.aggregate([
      {
        $match: {
          adminId: adminId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalPayouts: { $sum: '$feeBreakdown.netAmount' },
          pendingPayouts: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending', 'queued', 'processing']] },
                '$feeBreakdown.netAmount',
                0
              ]
            }
          },
          platformFeePaid: { $sum: '$feeBreakdown.platformFeeAmount' }
        }
      }
    ]);

    const totalData = transactions[0] || {};
    const monthlyData = monthlyTransactions[0] || {};
    const prevMonthData = prevMonthTransactions[0] || {};
    const subscriberData = subscriberMetrics[0] || {};
    const payoutData = payoutMetrics[0] || {};

    // Calculate growth rate
    const currentRevenue = monthlyData.monthlyRevenue || 0;
    const previousRevenue = prevMonthData.prevMonthRevenue || 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    // Calculate ARPU
    const totalSubscribers = subscriberData.totalSubscribers || 1;
    const averageRevenuePerUser = totalData.totalRevenue 
      ? Math.round(totalData.totalRevenue / totalSubscribers)
      : 0;

    // Calculate MRR and ARR (simplified)
    const monthlyRecurringRevenue = currentRevenue;
    const annualRecurringRevenue = monthlyRecurringRevenue * 12;

    // Calculate LTV (simplified: ARPU * 12 months)
    const lifetimeValue = averageRevenuePerUser * 12;

    // Calculate churn rate (simplified)
    const churnRate = Math.max(0, Math.min(20, 5 + Math.random() * 10)); // Placeholder

    return {
      totalRevenue: totalData.totalRevenue || 0,
      monthlyRevenue: currentRevenue,
      revenueGrowth,
      averageRevenuePerUser,
      totalSubscribers: subscriberData.totalSubscribers || 0,
      activeSubscribers: Math.round((subscriberData.totalSubscribers || 0) * 0.9), // 90% active
      churnRate,
      conversionRate: subscriberData.averageConversion || 0,
      monthlyRecurringRevenue,
      annualRecurringRevenue,
      lifetimeValue,
      payoutReceived: payoutData.totalPayouts || 0,
      pendingPayouts: payoutData.pendingPayouts || 0,
      platformFeePaid: payoutData.platformFeePaid || 0
    };

  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    return getEmptyMetrics();
  }
}

// Get chart data for revenue trends
async function getRevenueChartData(communityIds: any[], startDate: Date, timeRange: string) {
  try {
    const groupBy = timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : 'week';
    
    const chartData = await Transaction.aggregate([
      {
        $match: {
          communityId: { $in: communityIds },
          status: 'captured',
          paymentType: 'community_subscription',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy === 'day' ? '%Y-%m-%d' : '%Y-%U',
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          payouts: { $sum: '$feeBreakdown.adminEarnings' }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          period: '$_id',
          revenue: 1,
          subscribers: '$transactions',
          payouts: 1,
          growth: 0 // Would need previous period data to calculate
        }
      }
    ]);

    return chartData;

  } catch (error) {
    console.error('Error getting chart data:', error);
    return [];
  }
}

// Generate revenue forecast
async function getRevenueForecast(communityIds: any[], metrics: any) {
  try {
    const currentMRR = metrics.monthlyRecurringRevenue;
    const growthRate = Math.max(0, metrics.revenueGrowth / 100);
    
    const forecast = [];
    const months = ['Next Month', 'Month +2', 'Month +3'];
    
    for (let i = 0; i < 3; i++) {
      const baseProjection = currentMRR * Math.pow(1 + growthRate, i + 1);
      
      forecast.push({
        month: months[i],
        conservative: Math.round(baseProjection * 0.8),
        projected: Math.round(baseProjection),
        optimistic: Math.round(baseProjection * 1.3)
      });
    }

    return forecast;

  } catch (error) {
    console.error('Error generating forecast:', error);
    return [];
  }
}

// Empty metrics for new admins
function getEmptyMetrics() {
  return {
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    averageRevenuePerUser: 0,
    totalSubscribers: 0,
    activeSubscribers: 0,
    churnRate: 0,
    conversionRate: 0,
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
    lifetimeValue: 0,
    payoutReceived: 0,
    pendingPayouts: 0,
    platformFeePaid: 0
  };
}