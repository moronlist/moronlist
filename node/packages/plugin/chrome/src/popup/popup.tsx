import { StrictMode, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { AuthStatus } from "./components/auth-status.js";
import { SyncStatus } from "./components/sync-status.js";
import { ListItem } from "./components/list-item.js";
import { QuickAdd } from "./components/quick-add.js";
import { fetchMe, fetchMySubscriptions } from "../lib/api-client.js";
import { getApiUrl, setApiUrl } from "../lib/storage.js";
import type { User, Subscription } from "../lib/api-client.js";
import type { StatusResponse } from "../background/service-worker.js";
import "./popup.css";

type AppState = {
  user: User | null;
  subscriptions: Subscription[];
  status: StatusResponse | null;
  apiUrl: string;
  loading: boolean;
  error: string | null;
  showSettings: boolean;
};

function App() {
  const [state, setState] = useState<AppState>({
    user: null,
    subscriptions: [],
    status: null,
    apiUrl: "",
    loading: true,
    error: null,
    showSettings: false,
  });

  const loadData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [meResult, subsResult, statusResult, currentApiUrl] = await Promise.all([
        fetchMe(),
        fetchMySubscriptions(),
        chrome.runtime.sendMessage({ type: "GET_STATUS" }) as Promise<StatusResponse>,
        getApiUrl(),
      ]);

      setState((prev) => ({
        ...prev,
        user: meResult.success ? meResult.data : null,
        subscriptions: subsResult.success ? subsResult.data : [],
        status: statusResult,
        apiUrl: currentApiUrl,
        loading: false,
        error:
          !meResult.success && !subsResult.success
            ? "Unable to connect. Check your auth status."
            : null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await chrome.runtime.sendMessage({ type: "SYNC_NOW" });
      await loadData();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Sync failed",
      }));
    }
  }, [loadData]);

  const handleSaveApiUrl = useCallback(
    async (url: string) => {
      await setApiUrl(url);
      setState((prev) => ({ ...prev, apiUrl: url }));
      await loadData();
    },
    [loadData]
  );

  const handleToggleSettings = useCallback(() => {
    setState((prev) => ({ ...prev, showSettings: !prev.showSettings }));
  }, []);

  return (
    <div className="flex flex-col bg-gray-50 min-h-[480px]">
      <header className="bg-moron-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">MoronList</span>
          <span className="text-xs bg-moron-700 px-1.5 py-0.5 rounded">v0.0.1</span>
        </div>
        <button
          onClick={handleToggleSettings}
          className="text-white/80 hover:text-white text-sm"
          title="Settings"
        >
          {state.showSettings ? "Close" : "Settings"}
        </button>
      </header>

      {state.loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-moron-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {state.error !== null && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      {!state.loading && (
        <div className="flex-1 overflow-y-auto">
          <AuthStatus user={state.user} apiUrl={state.apiUrl} />

          {state.status !== null && <SyncStatus status={state.status} onSyncNow={handleSyncNow} />}

          {state.showSettings && (
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <label className="block text-xs font-medium text-gray-500 mb-1">API URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={state.apiUrl}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      apiUrl: e.target.value,
                    }))
                  }
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-moron-500"
                  placeholder="http://localhost:4000"
                />
                <button
                  onClick={() => handleSaveApiUrl(state.apiUrl)}
                  className="text-xs bg-moron-500 text-white px-3 py-1 rounded hover:bg-moron-600"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {state.user !== null && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Subscribed Lists ({state.subscriptions.length})
                </h2>
                {state.subscriptions.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No subscriptions yet. Visit moronlist.com to subscribe to lists.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {state.subscriptions.map((sub) => (
                      <ListItem key={sub.id} subscription={sub} />
                    ))}
                  </div>
                )}
              </div>

              <QuickAdd subscriptions={state.subscriptions} onAdded={loadData} />
            </>
          )}

          <div className="px-4 py-3">
            <a
              href={state.apiUrl.replace(/:\d+$/, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-moron-500 hover:text-moron-600 underline"
            >
              Open MoronList web app
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl !== null) {
  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
