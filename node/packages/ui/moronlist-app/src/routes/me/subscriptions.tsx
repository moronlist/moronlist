import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchMySubscriptions, unsubscribe, type Subscription } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

function MySubscriptionsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      void navigate({ to: "/" });
      return;
    }

    async function load() {
      try {
        const data = await fetchMySubscriptions();
        setSubscriptions(data);
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [isAuthenticated, authLoading, navigate]);

  const handleUnsubscribe = async (sub: Subscription) => {
    setUnsubscribingId(sub.listId);
    try {
      await unsubscribe(sub.listPlatform, sub.listSlug);
      setSubscriptions((prev) => prev.filter((s) => s.listId !== sub.listId));
    } catch {
      // Ignore
    } finally {
      setUnsubscribingId(null);
    }
  };

  return (
    <div className="container page-spacing content-spacing">
      <h2 className="text-display">My Subscriptions</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : subscriptions.length > 0 ? (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.listId} className="border p-4">
              <div className="flex items-center justify-between">
                <Link
                  to="/$platform/$slug"
                  params={{ platform: sub.listPlatform, slug: sub.listSlug }}
                  className="no-underline flex-1 min-w-0"
                >
                  <CardHeader className="mb-0 p-0">
                    <CardTitle className="text-base font-semibold hover:underline">
                      {sub.listName ?? sub.listId}
                    </CardTitle>
                    <CardDescription className="line-clamp-1 mt-1">
                      {sub.listDescription ?? "No description"}
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {sub.listPlatform}/{sub.listSlug}
                    </span>
                    {sub.listVersion !== null && <span>v{sub.listVersion}</span>}
                    <span>subscribed {new Date(sub.subscribedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 shrink-0"
                  disabled={unsubscribingId === sub.listId}
                  onClick={() => void handleUnsubscribe(sub)}
                >
                  <Star className="h-3.5 w-3.5 mr-1 fill-current" />
                  {unsubscribingId === sub.listId ? "..." : "Unsubscribe"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You are not subscribed to any lists yet.</p>
          <Link to="/$platform" params={{ platform: "x" }}>
            <Button variant="outline">Browse Lists</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/me/subscriptions")({
  component: MySubscriptionsPage,
});
