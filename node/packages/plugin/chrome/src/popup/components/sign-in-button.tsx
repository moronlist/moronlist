import { useState, useCallback } from "react";

type SignInButtonProps = {
  onSignedIn: () => void;
};

export function SignInButton({ onSignedIn }: SignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await chrome.runtime.sendMessage({ type: "LOGIN" })) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        onSignedIn();
      } else {
        setError(result.error ?? "Sign in failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }, [onSignedIn]);

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-moron-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-moron-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Signing in..." : "Sign In with Google"}
      </button>
      {error !== null && <div className="mt-2 text-xs text-red-500">{error}</div>}
    </div>
  );
}
