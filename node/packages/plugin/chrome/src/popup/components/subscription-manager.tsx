import { useState, useCallback } from "react";
import { subscribe, unsubscribe } from "../../lib/api-client.js";
import type { Subscription } from "../../lib/api-client.js";

type SubscriptionManagerProps = {
  subscriptions: Subscription[];
  onChanged: () => void;
};

export function SubscriptionManager({ subscriptions, onChanged }: SubscriptionManagerProps) {
  const [listId, setListId] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubscribe = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (listId.trim().length === 0) {
        return;
      }

      setSubscribing(true);
      setFeedback(null);

      const result = await subscribe(listId.trim());
      if (result.success) {
        setFeedback("Subscribed successfully");
        setListId("");
        onChanged();
      } else {
        setFeedback(`Error: ${result.error}`);
      }
      setSubscribing(false);
    },
    [listId, onChanged]
  );

  const handleUnsubscribe = useCallback(
    async (sub: Subscription) => {
      setUnsubscribing(sub.id);
      setFeedback(null);

      const result = await unsubscribe(sub.platform, sub.slug);
      if (result.success) {
        setFeedback(`Unsubscribed from ${sub.name}`);
        onChanged();
      } else {
        setFeedback(`Error: ${result.error}`);
      }
      setUnsubscribing(null);
    },
    [onChanged]
  );

  return (
    <div className="px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Subscriptions ({subscriptions.length})
      </h2>

      <form onSubmit={handleSubscribe} className="flex gap-2 mb-3">
        <input
          type="text"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          placeholder="List ID to subscribe..."
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
        />
        <button
          type="submit"
          disabled={subscribing || listId.trim().length === 0}
          className="text-xs bg-moron-500 text-white px-3 py-1.5 rounded hover:bg-moron-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {subscribing ? "..." : "Sub"}
        </button>
      </form>

      {feedback !== null && (
        <div
          className={`mb-3 text-xs p-2 rounded ${
            feedback.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}
        >
          {feedback}
        </div>
      )}

      {subscriptions.length === 0 ? (
        <p className="text-xs text-gray-400">
          No subscriptions yet. Enter a list ID above to subscribe.
        </p>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{sub.name}</div>
                  <div className="text-xs text-gray-400">
                    {sub.platform}/{sub.slug}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span
                    className="text-xs bg-moron-100 text-moron-700 px-1.5 py-0.5 rounded"
                    title="Blocked entries"
                  >
                    {sub.entryCount}
                  </span>
                  {sub.saintCount > 0 && (
                    <span
                      className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                      title="Sainted entries"
                    >
                      {sub.saintCount}
                    </span>
                  )}
                  <button
                    onClick={() => handleUnsubscribe(sub)}
                    disabled={unsubscribing === sub.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    title="Unsubscribe"
                  >
                    {unsubscribing === sub.id ? "..." : "Unsub"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
