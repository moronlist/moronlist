import { StrictMode, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { SignInButton } from "./components/sign-in-button.js";
import { QuickAdd } from "./components/quick-add.js";
import { MyLists } from "./components/my-lists.js";
import { SubscriptionManager } from "./components/subscription-manager.js";
import { CreateListForm } from "./components/create-list-form.js";
import {
  fetchMe,
  fetchMySubscriptions,
  fetchMyLists,
  completeOnboarding,
} from "../lib/api-client.js";
import {
  getApiUrl,
  setApiUrl,
  getDataUrl,
  setDataUrl,
  getUser,
  setUser,
  getPendingUsername,
  setPendingUsername,
} from "../lib/storage.js";
import type { User, Subscription, MoronList } from "../lib/api-client.js";
import type { StatusResponse } from "../background/service-worker.js";
import "./popup.css";

type TabId = "home" | "lists" | "subscriptions" | "settings";

type AppState = {
  user: User | null;
  needsOnboarding: boolean;
  onboardingIdentity: { id: string; email: string; name?: string } | null;
  subscriptions: Subscription[];
  myLists: MoronList[];
  status: StatusResponse | null;
  apiUrl: string;
  dataUrl: string;
  activeTab: TabId;
  loading: boolean;
  error: string | null;
  pendingUsername: string | null;
  showCreateList: boolean;
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

function OnboardingForm({
  identity,
  onComplete,
  onLogout,
}: {
  identity: { id: string; email: string; name?: string } | null;
  onComplete: () => void;
  onLogout: () => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(identity?.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (username.trim().length < 3) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await completeOnboarding(username.trim(), displayName.trim());
      if (result.success) {
        onComplete();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700">Welcome to MoronList</h2>
        <button onClick={onLogout} className="text-[10px] text-gray-400 hover:text-gray-600">
          Sign out
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {identity?.email ?? "Pick a username to get started."}
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jesternz"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
            minLength={3}
            maxLength={24}
          />
          <p className="text-[10px] text-gray-400 mt-1">3-24 chars, lowercase, underscores ok</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>
        {error !== null && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || username.trim().length < 3}
          className="w-full text-xs bg-moron-500 text-white px-3 py-2 rounded hover:bg-moron-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating..." : "Get Started"}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [state, setState] = useState<AppState>({
    user: null,
    needsOnboarding: false,
    onboardingIdentity: null,
    subscriptions: [],
    myLists: [],
    status: null,
    apiUrl: "",
    dataUrl: "",
    activeTab: "home",
    loading: true,
    error: null,
    pendingUsername: null,
    showCreateList: false,
  });

  const loadData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [storedUser, statusResult, currentApiUrl, currentDataUrl, pending] = await Promise.all([
        getUser(),
        chrome.runtime.sendMessage({ type: "GET_STATUS" }) as Promise<StatusResponse>,
        getApiUrl(),
        getDataUrl(),
        getPendingUsername(),
      ]);

      let user = storedUser;
      let needsOnboarding = false;
      let onboardingIdentity: AppState["onboardingIdentity"] = null;
      let subscriptions: Subscription[] = [];
      let myLists: MoronList[] = [];

      // Check auth status if we have a token
      const token = await (await import("../lib/storage.js")).getAuthToken();
      if (token !== null) {
        const meResult = await fetchMe();
        if (meResult.success) {
          const meData = meResult.data;
          if (meData.needsOnboarding === true) {
            needsOnboarding = true;
            onboardingIdentity = meData.identity ?? null;
            user = null;
          } else if (meData.user !== null) {
            user = meData.user;
            await setUser({ id: user.id, name: user.name, email: user.email });

            const [subsResult, listsResult] = await Promise.all([
              fetchMySubscriptions(),
              fetchMyLists(),
            ]);
            subscriptions = subsResult.success ? subsResult.data : [];
            myLists = listsResult.success ? listsResult.data : [];
          }
        }
      }

      // If there's a pending username, switch to home tab
      const activeTab = pending !== null ? "home" : state.activeTab;

      setState((prev) => ({
        ...prev,
        user,
        needsOnboarding,
        onboardingIdentity,
        subscriptions,
        myLists,
        status: statusResult,
        apiUrl: currentApiUrl,
        dataUrl: currentDataUrl,
        loading: false,
        pendingUsername: pending,
        activeTab,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [state.activeTab]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  const handleSignOut = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    setState((prev) => ({
      ...prev,
      user: null,
      subscriptions: [],
      myLists: [],
      activeTab: "home",
    }));
  }, []);

  const handleSaveApiUrl = useCallback(
    async (url: string) => {
      await setApiUrl(url);
      setState((prev) => ({ ...prev, apiUrl: url }));
      await loadData();
    },
    [loadData]
  );

  const handleSaveDataUrl = useCallback(async (url: string) => {
    await setDataUrl(url);
    setState((prev) => ({ ...prev, dataUrl: url }));
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const handleClearPending = useCallback(async () => {
    await setPendingUsername(null);
    setState((prev) => ({ ...prev, pendingUsername: null }));
  }, []);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "home", label: "Home" },
    { id: "lists", label: "My Lists" },
    { id: "subscriptions", label: "Subs" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col bg-gray-50 min-h-[480px]">
      <header className="bg-moron-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">MoronList</span>
          <span className="text-xs bg-moron-700 px-1.5 py-0.5 rounded">v0.0.1</span>
        </div>
        {state.user !== null && (
          <span className="text-xs text-white/70 truncate max-w-[120px]">{state.user.name}</span>
        )}
      </header>

      {state.user !== null && (
        <nav className="flex bg-white border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${
                state.activeTab === tab.id
                  ? "text-moron-600 border-b-2 border-moron-500"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

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
          {state.user === null && !state.needsOnboarding && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Sign in to MoronList to manage your block lists.
              </p>
              <SignInButton onSignedIn={loadData} />
            </div>
          )}

          {state.needsOnboarding && (
            <OnboardingForm
              identity={state.onboardingIdentity}
              onComplete={loadData}
              onLogout={() => void handleSignOut()}
            />
          )}

          {state.user !== null && state.activeTab === "home" && (
            <>
              {state.status !== null && (
                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Stats</h2>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-moron-600">
                        {state.status.blockedCount}
                      </div>
                      <div className="text-xs text-gray-400">Blocked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {state.status.saintedCount}
                      </div>
                      <div className="text-xs text-gray-400">Sainted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {state.status.listCount}
                      </div>
                      <div className="text-xs text-gray-400">Lists</div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-400 text-center">
                    {state.status.lastSyncTime !== null
                      ? `Last sync: ${formatRelativeTime(state.status.lastSyncTime)}`
                      : "Never synced"}
                  </div>
                </div>
              )}

              <QuickAdd
                myLists={state.myLists}
                pendingUsername={state.pendingUsername}
                onClearPending={handleClearPending}
                onAdded={loadData}
              />
            </>
          )}

          {state.user !== null && state.activeTab === "lists" && (
            <>
              {state.showCreateList ? (
                <CreateListForm
                  onCreated={() => {
                    setState((prev) => ({ ...prev, showCreateList: false }));
                    loadData();
                  }}
                  onCancel={() => setState((prev) => ({ ...prev, showCreateList: false }))}
                />
              ) : (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                      My Lists ({state.myLists.length})
                    </h2>
                    <button
                      onClick={() => setState((prev) => ({ ...prev, showCreateList: true }))}
                      className="text-xs bg-moron-500 text-white px-3 py-1 rounded hover:bg-moron-600"
                    >
                      New List
                    </button>
                  </div>
                  <MyLists lists={state.myLists} onDeleted={loadData} />
                </div>
              )}
            </>
          )}

          {state.user !== null && state.activeTab === "subscriptions" && (
            <SubscriptionManager subscriptions={state.subscriptions} onChanged={loadData} />
          )}

          {state.activeTab === "settings" && (
            <div className="px-4 py-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">API URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={state.apiUrl}
                    onChange={(e) => setState((prev) => ({ ...prev, apiUrl: e.target.value }))}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-moron-500"
                    placeholder="https://api.moronlist.com"
                  />
                  <button
                    onClick={() => handleSaveApiUrl(state.apiUrl)}
                    className="text-xs bg-moron-500 text-white px-3 py-1 rounded hover:bg-moron-600"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={state.dataUrl}
                    onChange={(e) => setState((prev) => ({ ...prev, dataUrl: e.target.value }))}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-moron-500"
                    placeholder="https://data.moronlist.com"
                  />
                  <button
                    onClick={() => handleSaveDataUrl(state.dataUrl)}
                    className="text-xs bg-moron-500 text-white px-3 py-1 rounded hover:bg-moron-600"
                  >
                    Save
                  </button>
                </div>
              </div>

              {state.user !== null && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{state.user.name}</div>
                      <div className="text-xs text-gray-400">{state.user.email}</div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
