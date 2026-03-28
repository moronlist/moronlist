import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchUser, fetchUserMorons, type PublicUser, type PublicList } from "@/api/client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function UserProfilePage() {
  const { userId } = Route.useParams();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [lists, setLists] = useState<PublicList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [userData, listsData] = await Promise.all([
          fetchUser(userId),
          fetchUserMorons(userId),
        ]);
        setUser(userData);
        setLists(listsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="container page-spacing">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error !== null || user === null) {
    return (
      <div className="container page-spacing text-center">
        <h2 className="mb-4">User not found</h2>
        <p className="text-muted-foreground mb-4">
          {error ?? "The user you are looking for does not exist."}
        </p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container page-spacing content-spacing">
      {/* Profile Header */}
      <div>
        <h2 className="text-display">{user.name}</h2>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span>@{user.id}</span>
          {user.role !== "USER" && <Badge variant="secondary">{user.role}</Badge>}
          <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Public Lists */}
      <div>
        <h3 className="text-heading mb-4">Public Lists ({lists.length})</h3>
        {lists.length > 0 ? (
          <div className="grid-lists gap-4">
            {lists.map((list) => (
              <Link
                key={`${list.platform}/${list.slug}`}
                to="/$platform/$slug"
                params={{ platform: list.platform, slug: list.slug }}
                className="no-underline"
              >
                <Card className="border p-4 hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="mb-0 p-0">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold">{list.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                        {list.platform}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-1">
                      {list.description ?? "No description"}
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-3 text-xs text-muted-foreground">v{list.version}</div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">This user has no public lists.</p>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/user/$userId")({
  component: UserProfilePage,
});
