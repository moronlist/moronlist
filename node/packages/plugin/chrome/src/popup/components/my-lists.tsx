import { useState, useCallback } from "react";
import { deleteList } from "../../lib/api-client.js";
import type { MoronList } from "../../lib/api-client.js";

type MyListsProps = {
  lists: MoronList[];
  onDeleted: () => void;
};

export function MyLists({ lists, onDeleted }: MyListsProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (list: MoronList) => {
      const confirmed = window.confirm(
        `Delete "${list.name}" (${list.platform}/${list.slug})? This cannot be undone.`
      );
      if (!confirmed) {
        return;
      }

      setDeleting(list.id);
      setError(null);

      const result = await deleteList(list.platform, list.slug);
      if (result.success) {
        onDeleted();
      } else {
        setError(result.error);
      }
      setDeleting(null);
    },
    [onDeleted]
  );

  if (lists.length === 0) {
    return (
      <p className="text-xs text-gray-400">No lists yet. Create your first list to get started.</p>
    );
  }

  return (
    <div className="space-y-2">
      {error !== null && <div className="text-xs text-red-500 p-2 bg-red-50 rounded">{error}</div>}

      {lists.map((list) => (
        <div key={list.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{list.name}</div>
              <div className="text-xs text-gray-400">
                {list.platform}/{list.slug}
              </div>
              {list.description !== null && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">{list.description}</div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <span className="text-xs text-gray-400">{list.visibility}</span>
              <button
                onClick={() => handleDelete(list)}
                disabled={deleting === list.id}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                title="Delete list"
              >
                {deleting === list.id ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
