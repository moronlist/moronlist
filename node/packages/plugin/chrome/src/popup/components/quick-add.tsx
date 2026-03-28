import { useState, useCallback } from "react";
import type { Subscription, Result } from "../../lib/api-client.js";

type QuickAddProps = {
  subscriptions: Subscription[];
  onAdded: () => void;
};

type AddMode = "moron" | "saint";

export function QuickAdd({ subscriptions, onAdded }: QuickAddProps) {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [mode, setMode] = useState<AddMode>("moron");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedSub = subscriptions.find((s) => s.id === selectedListId);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedSub === undefined || username.trim().length === 0) {
        return;
      }

      setSubmitting(true);
      setFeedback(null);

      try {
        const messageType = mode === "moron" ? "ADD_ENTRY" : "ADD_SAINT";
        const result = (await chrome.runtime.sendMessage({
          type: messageType,
          platform: selectedSub.platform,
          slug: selectedSub.slug,
          platformUserId: username.trim().replace(/^@/, ""),
          reason: reason.trim().length > 0 ? reason.trim() : undefined,
        })) as Result<unknown>;

        if (result.success) {
          setFeedback(
            mode === "moron"
              ? `Added @${username.trim()} as a moron`
              : `Added @${username.trim()} as a saint`
          );
          setUsername("");
          setReason("");
          onAdded();
        } else {
          setFeedback(`Error: ${result.error}`);
        }
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Failed to add entry");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedSub, username, reason, mode, onAdded]
  );

  if (subscriptions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Quick Add</h2>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500 bg-white"
          >
            <option value="">Select a list...</option>
            {subscriptions.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} ({sub.platform}/{sub.slug})
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>

        <div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded p-0.5 flex-1">
            <button
              type="button"
              onClick={() => setMode("moron")}
              className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                mode === "moron" ? "bg-moron-500 text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Moron
            </button>
            <button
              type="button"
              onClick={() => setMode("saint")}
              className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                mode === "saint" ? "bg-green-500 text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Saint
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || selectedListId.length === 0 || username.trim().length === 0}
            className="text-xs bg-moron-500 text-white px-4 py-1.5 rounded hover:bg-moron-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {feedback !== null && (
        <div
          className={`mt-2 text-xs p-2 rounded ${
            feedback.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
