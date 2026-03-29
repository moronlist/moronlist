import { useState, useCallback } from "react";
import { createList } from "../../lib/api-client.js";

type CreateListFormProps = {
  onCreated: () => void;
  onCancel: () => void;
};

export function CreateListForm({ onCreated, onCancel }: CreateListFormProps) {
  const [platform, setPlatform] = useState("twitter");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (slug.trim().length === 0 || name.trim().length === 0) {
        return;
      }

      setSubmitting(true);
      setError(null);

      const result = await createList({
        platform,
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : undefined,
        visibility,
      });

      if (result.success) {
        onCreated();
      } else {
        setError(result.error);
      }
      setSubmitting(false);
    },
    [platform, slug, name, description, visibility, onCreated]
  );

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Create New List</h2>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500 bg-white"
          >
            <option value="twitter">X (Twitter)</option>
            <option value="bluesky">Bluesky</option>
            <option value="mastodon">Mastodon</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-list"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Block List"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description..."
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moron-500 bg-white"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>

        {error !== null && (
          <div className="text-xs text-red-500 p-2 bg-red-50 rounded">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || slug.trim().length === 0 || name.trim().length === 0}
          className="w-full text-xs bg-moron-500 text-white px-3 py-2 rounded hover:bg-moron-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating..." : "Create List"}
        </button>
      </form>
    </div>
  );
}
