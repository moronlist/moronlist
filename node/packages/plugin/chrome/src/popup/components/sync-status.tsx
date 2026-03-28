import type { StatusResponse } from "../../background/service-worker.js";

type SyncStatusProps = {
  status: StatusResponse;
  onSyncNow: () => void;
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

export function SyncStatus({ status, onSyncNow }: SyncStatusProps) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Sync Status</h2>
        <button
          onClick={onSyncNow}
          className="text-xs bg-moron-500 text-white px-2.5 py-1 rounded hover:bg-moron-600 transition-colors"
        >
          Sync Now
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold text-moron-600">{status.blockedCount}</div>
          <div className="text-xs text-gray-400">Blocked</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{status.saintedCount}</div>
          <div className="text-xs text-gray-400">Sainted</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{status.listCount}</div>
          <div className="text-xs text-gray-400">Lists</div>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400 text-center">
        {status.lastSyncTime !== null
          ? `Last sync: ${formatRelativeTime(status.lastSyncTime)}`
          : "Never synced"}
      </div>
    </div>
  );
}
