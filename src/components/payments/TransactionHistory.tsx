"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Transaction {
  _id: string;
  orderId: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  paymentType: "platform" | "community" | "community_subscription";
  payerId: string;
  payeeId?: string;
  communityId?: {
    _id: string;
    name: string;
    slug: string;
  };
  planId?: {
    _id: string;
    name: string;
    description?: string;
  };
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface TransactionHistoryProps {
  type?: "payer" | "payee";
  paymentType?: "platform" | "community" | "community_subscription";
  communityId?: string;
  limit?: number;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  type,
  paymentType,
  communityId,
  limit = 10,
}) => {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (page: number = 1) => {
    if (!session?.user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      
      if (type) {
        params.append("type", type);
      }
      
      if (paymentType) {
        params.append("paymentType", paymentType);
      }
      
      if (communityId) {
        params.append("communityId", communityId);
      }

      // Fetch transactions
      const response = await fetch(`/api/payments/transactions?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch transactions");
      }

      const data = await response.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to fetch transactions"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchTransactions(1);
    }
  }, [session, type, paymentType, communityId, limit]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchTransactions(newPage);
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "captured":
        return "badge-success";
      case "authorized":
        return "badge-info";
      case "created":
        return "badge-warning";
      case "refunded":
        return "badge-secondary";
      case "failed":
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand-primary)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-6 text-center">
        <p style={{ color: "var(--text-secondary)" }}>No transactions found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table w-full">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction._id} className="hover">
              <td>{formatDate(transaction.createdAt)}</td>
              <td>
                <div>
                  {transaction.planId ? (
                    <span className="font-medium">{transaction.planId.name}</span>
                  ) : (
                    <span className="font-medium">
                      {transaction.paymentType === "platform"
                        ? "Platform Payment"
                        : transaction.paymentType === "community_subscription"
                        ? "Community Subscription"
                        : "Community Payment"}
                    </span>
                  )}
                  {transaction.communityId && (
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Community: {transaction.communityId.name}
                    </div>
                  )}
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Order ID: {transaction.orderId.substring(0, 10)}...
                  </div>
                </div>
              </td>
              <td className="font-medium">
                {formatCurrency(transaction.amount, transaction.currency)}
              </td>
              <td>
                <span
                  className={`badge ${getStatusBadgeColor(
                    transaction.status
                  )} text-xs`}
                >
                  {transaction.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="btn btn-sm btn-ghost"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm">
            Page {pagination.page} of {pagination.pages}
          </span>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className="btn btn-sm btn-ghost"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
