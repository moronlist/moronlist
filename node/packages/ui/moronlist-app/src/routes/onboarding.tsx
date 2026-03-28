import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPendingProfile, completeOnboarding, type PendingProfile } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function OnboardingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, needsOnboarding, refreshUser } = useAuth();

  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !needsOnboarding) {
      void navigate({ to: "/" });
      return;
    }

    async function loadProfile() {
      try {
        const p = await fetchPendingProfile();
        if (p !== null) {
          setProfile(p);
          if (p.name !== null) {
            setDisplayName(p.name);
          }
        }
      } catch {
        // Ignore
      }
    }
    void loadProfile();
  }, [isAuthenticated, needsOnboarding, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const trimmedId = userId.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (trimmedId.length < 2) {
      setFieldError("Username must be at least 2 characters");
      return;
    }

    if (trimmedName.length < 1) {
      setFieldError("Display name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await completeOnboarding({ id: trimmedId, name: trimmedName });
      await refreshUser();
      void navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete onboarding";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-md page-spacing">
      <Card className="border p-6">
        <CardHeader>
          <CardTitle>Welcome to MoronList</CardTitle>
          <CardDescription>
            {profile !== null
              ? `Signed in as ${profile.email}. Choose your username.`
              : "Set up your account to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. john_doe"
                autoComplete="off"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and underscores. Cannot be changed later.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Display Name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={isSubmitting}
              />
            </div>
            {fieldError !== null && <p className="text-sm text-destructive">{fieldError}</p>}
            {error !== null && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});
