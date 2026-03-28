import { useState, useCallback, useEffect } from "react";
import type { Subscription, Result } from "../../lib/api-client.js";
import {
  getLastSelectedListIds,
  setLastSelectedListIds,
  getPendingUsername,
  setPendingUsername,
} from "../../lib/storage.js";

type QuickAddProps = {
  subscriptions: Subscription[];
  onAdded: () => void;
};

type AddMode = "moron" | "saint";

export function QuickAdd({ subscriptions, onAdded }: QuickAddProps) {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AddMode>("moron");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load last selected lists and any pending username from content script
  useEffect(() => {
    const load = async (): Promise<void> => {
      const [lastIds, pending] = await Promise.all([
        getLastSelectedListIds(),
        getPendingUsername(),
      ]);

      if (lastIds.length > 0) {
        // Only keep IDs that still exist in subscriptions
        const validIds = lastIds.filter((id) => subscriptions.some((s) => s.id === id));
        setSelectedIds(new Set(validIds));
      }

      if (pending !== null && pending.length > 0) {
        setUsername(pending.replace(/^@/, ""));
        await setPendingUsername(null);
      }
    };
    load();
  }, [subscriptions]);

  const toggleList = useCallback((listId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      setLastSelectedListIds([...next]);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedIds.size === 0 || username.trim().length === 0) {
        return;
      }

      setSubmitting(true);
      setFeedback(null);

      const cleanUsername = username.trim().replace(/^@/, "");
      const messageType = mode === "moron" ? "ADD_ENTRY" : "ADD_SAINT";
      const selectedSubs = subscriptions.filter((s) => selectedIds.has(s.id));

      let successCount = 0;
      let errorCount = 0;

      for (const sub of selectedSubs) {
        try {
          const result = (await chrome.runtime.sendMessage({
            type: messageType,
            platform: sub.platform,
            slug: sub.slug,
            platformUserId: cleanUsername,
            reason: reason.trim().length > 0 ? reason.trim() : undefined,
          })) as Result<unknown>;

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        const label = mode === "moron" ? "moron" : "saint";
        setFeedback(
          `Added @${cleanUsername} as ${label} to ${String(successCount)} list${successCount > 1 ? "s" : ""}`
        );
        setUsername("");
        setReason("");
        onAdded();
      } else {
        setFeedback(
          `Added to ${String(successCount)}, failed on ${String(errorCount)} list${errorCount > 1 ? "s" : ""}`
        );
      }

      setSubmitting(false);
    },
    [selectedIds, username, reason, mode, subscriptions, onAdded]
  );

  if (subscriptions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Quick Add</h2>

      <form onSubmit={handleSubmit} className="space-y-2">
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

        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded">
          {subscriptions.map((sub) => (
            <label
              key={sub.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(sub.id)}
                onChange={() => toggleList(sub.id)}
                className="rounded border-gray-300 text-moron-500 focus:ring-moron-500"
              />
              <span className="truncate text-gray-700">{sub.name}</span>
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                {sub.platform}/{sub.slug}
              </span>
            </label>
          ))}
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
            disabled={submitting || selectedIds.size === 0 || username.trim().length === 0}
            className="text-xs bg-moron-500 text-white px-4 py-1.5 rounded hover:bg-moron-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? "Adding..."
              : `Add to ${String(selectedIds.size)} list${selectedIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </form>

      {feedback !== null && (
        <div
          className={`mt-2 text-xs p-2 rounded ${
            feedback.startsWith("Added to 0") || feedback.includes("failed")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
