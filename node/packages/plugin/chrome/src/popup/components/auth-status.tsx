import type { User } from "../../lib/api-client.js";

type AuthStatusProps = {
  user: User | null;
  apiUrl: string;
};

export function AuthStatus({ user, apiUrl }: AuthStatusProps) {
  if (user !== null) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
        <div className="w-8 h-8 bg-moron-100 text-moron-600 rounded-full flex items-center justify-center font-bold text-sm">
          {user.displayName !== null
            ? user.displayName.charAt(0).toUpperCase()
            : user.username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {user.displayName ?? user.username}
          </div>
          <div className="text-xs text-gray-400 truncate">{user.email}</div>
        </div>
        <div className="w-2 h-2 bg-green-400 rounded-full" title="Signed in" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-yellow-400 rounded-full" />
        <span className="text-sm font-medium text-yellow-800">Not signed in</span>
      </div>
      <p className="text-xs text-yellow-600 mb-2">Sign in to MoronList to sync your block lists.</p>
      <a
        href={apiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs bg-yellow-600 text-white px-3 py-1.5 rounded hover:bg-yellow-700"
      >
        Sign in
      </a>
    </div>
  );
}
