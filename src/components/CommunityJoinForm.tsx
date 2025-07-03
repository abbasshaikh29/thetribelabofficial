import { useState } from "react";
import { useSession } from "next-auth/react";
import PaymentGatewayDialog from "./community/PaymentGatewayDialog";

interface CommunityJoinFormProps {
  communityId: string;
  communitySlug: string;
  communityName: string;
  questions: string[];
  onSuccess?: () => void;
}

export default function CommunityJoinForm({
  communityId,
  communitySlug,
  communityName,
  questions,
  onSuccess,
}: CommunityJoinFormProps) {
  const { data: session } = useSession();
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requiresPayment, setRequiresPayment] = useState(false);
  const [communityData, setCommunityData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRequiresPayment(false);

    try {
      const response = await fetch("/api/community/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId,
          answers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if payment is required
        if (response.status === 402 && data.requiresPayment) {
          // Fetch community data for payment dialog
          const communityResponse = await fetch(
            `/api/community/${communitySlug}`
          );
          if (communityResponse.ok) {
            const community = await communityResponse.json();
            setCommunityData(community);
          }
          setRequiresPayment(true);
          return;
        }
        throw new Error(data.error || "Failed to send join request");
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  if (!session) {
    return <div>Please sign in to join this community</div>;
  }

  // If payment is required, show the payment dialog
  if (requiresPayment && communityData) {
    return (
      <PaymentGatewayDialog
        isOpen={requiresPayment}
        onClose={() => setRequiresPayment(false)}
        communityId={communityId}
        communitySlug={communitySlug}
        communityName={communityName}
        price={communityData.price || 0}
        currency={communityData.currency}
        pricingType={communityData.pricingType}
        onSuccess={() => {
          setRequiresPayment(false);
          if (onSuccess) {
            onSuccess();
          }
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      {error && (
        <div
          className="border px-3 py-2 sm:px-4 sm:py-3 rounded text-sm sm:text-base"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--brand-error)",
            color: "var(--brand-error)",
          }}
        >
          {error}
        </div>
      )}

      {questions.length === 0 ? (
        <div
          className="mb-3 text-sm sm:text-base"
          style={{ color: "var(--text-secondary)" }}
        >
          This community doesn't require any questions to be answered to join.
        </div>
      ) : (
        questions.map((question, index) => (
          <div key={index} className="space-y-1 sm:space-y-2">
            <label
              className="block text-xs sm:text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {question}
            </label>
            <textarea
              value={answers[index] || ""}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              className="w-full px-2 py-1 sm:px-3 sm:py-2 border rounded-md shadow-sm focus:outline-none text-sm"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--input-border)",
                color: "var(--text-primary)",
              }}
              rows={2}
              required
              placeholder={`Enter your answer for: ${question}`}
            />
          </div>
        ))
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-1 px-3 sm:py-2 sm:px-4 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200"
        style={{
          backgroundColor: loading ? "var(--neutral)" : "var(--brand-primary)",
          color: "var(--primary-content)",
          borderColor: loading ? "var(--neutral)" : "var(--brand-primary)",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = "var(--brand-secondary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = "var(--brand-primary)";
          }
        }}
      >
        {loading ? "Sending request..." : "Send Join Request"}
      </button>
    </form>
  );
}
