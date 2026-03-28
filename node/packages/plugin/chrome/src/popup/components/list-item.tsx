import type { Subscription } from "../../lib/api-client.js";

type ListItemProps = {
  subscription: Subscription;
};

export function ListItem({ subscription }: ListItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{subscription.name}</div>
          <div className="text-xs text-gray-400">
            {subscription.platform}/{subscription.slug}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span
            className="text-xs bg-moron-100 text-moron-700 px-1.5 py-0.5 rounded"
            title="Blocked entries"
          >
            {subscription.entryCount}
          </span>
          {subscription.saintCount > 0 && (
            <span
              className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
              title="Sainted entries"
            >
              {subscription.saintCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
