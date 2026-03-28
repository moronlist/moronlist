import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchMyMorons, type MyList } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

function MyListsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [lists, setLists] = useState<MyList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      void navigate({ to: "/" });
      return;
    }

    async function load() {
      try {
        const data = await fetchMyMorons();
        setLists(data);
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [isAuthenticated, authLoading, navigate]);

  return (
    <div className="container page-spacing content-spacing">
      <div className="flex items-center justify-between">
        <h2 className="text-display">My Lists</h2>
        <Link to="/$platform" params={{ platform: "x" }} search={{ create: true }}>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid-lists gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : lists.length > 0 ? (
        <div className="grid-lists gap-4">
          {lists.map((list) => (
            <Link
              key={list.id}
              to="/$platform/$slug"
              params={{ platform: list.platform, slug: list.slug }}
              className="no-underline"
            >
              <Card className="border p-4 hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="mb-0 p-0">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">{list.name}</CardTitle>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {list.platform}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {list.visibility}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1">
                    {list.description ?? "No description"}
                  </CardDescription>
                </CardHeader>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>v{list.version}</span>
                  {list.forkedFrom !== null && <span>forked from {list.forkedFrom}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You have not created any lists yet.</p>
          <Link to="/$platform" params={{ platform: "x" }} search={{ create: true }}>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Your First List
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/me/lists")({
  component: MyListsPage,
});
