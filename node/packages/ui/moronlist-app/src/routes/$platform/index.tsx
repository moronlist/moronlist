import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import {
  browsePlatform,
  searchPlatform,
  popularOnPlatform,
  createMoronList,
  type MoronList,
} from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus } from "lucide-react";

const PLATFORM_NAMES: Record<string, string> = {
  x: "X (Twitter)",
};

type SearchParams = {
  create?: boolean;
};

function PlatformPage() {
  const { platform } = Route.useParams();
  const searchParams = useSearch({ from: "/$platform/" }) as SearchParams;
  const { isAuthenticated, user } = useAuth();

  const [lists, setLists] = useState<MoronList[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("popular");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Create dialog
  const [showCreate, setShowCreate] = useState(searchParams.create === true);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVisibility, setNewVisibility] = useState("public");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeSearch.length > 0) {
        const result = await searchPlatform(platform, activeSearch, offset, limit);
        setLists(result.lists);
        setTotal(result.lists.length); // Search doesn't return total
      } else if (sortBy === "popular") {
        const result = await popularOnPlatform(platform, offset, limit);
        setLists(result.lists);
        setTotal(result.lists.length);
      } else {
        const result = await browsePlatform(platform, offset, limit);
        setLists(result.lists);
        setTotal(result.total);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [platform, activeSearch, sortBy, offset]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setActiveSearch(searchQuery.trim());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const list = await createMoronList({
        platform,
        slug: newSlug.trim().toLowerCase(),
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        visibility: newVisibility,
      });
      setShowCreate(false);
      setNewSlug("");
      setNewName("");
      setNewDescription("");
      // Reload lists to show the new one
      void loadLists();
      // Could navigate to the new list but reloading is simpler
      void list;
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setIsCreating(false);
    }
  };

  const platformName = PLATFORM_NAMES[platform] ?? platform;

  return (
    <div className="container page-spacing content-spacing">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-display mb-1">{platformName}</h2>
          <p className="text-muted-foreground">
            Browse community-curated block lists for {platformName}.
          </p>
        </div>
        {isAuthenticated && user !== null && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        )}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lists..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as "recent" | "popular");
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active search indicator */}
      {activeSearch.length > 0 && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Search results for &quot;{activeSearch}&quot;
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveSearch("");
              setSearchQuery("");
              setOffset(0);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Lists Grid */}
      {isLoading ? (
        <div className="grid-lists gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2 mb-4" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </Card>
          ))}
        </div>
      ) : lists.length > 0 ? (
        <>
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
                      {list.forkedFrom !== null && (
                        <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                          fork
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 mt-1">
                      {list.description ?? "No description"}
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>@{list.ownerId}</span>
                    <span>v{list.version}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.floor(offset / limit) + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={lists.length < limit}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-8">
          No lists found. {isAuthenticated ? "Create the first one!" : "Sign in to create one."}
        </p>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>Create a new block list on {platformName}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="newSlug" className="text-sm font-medium">
                Slug
              </label>
              <Input
                id="newSlug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g. ai-bots"
                disabled={isCreating}
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier. Your list will be at moronlist.com/{platform}/
                {newSlug || "..."}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="newName" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. AI Bots and Spam"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newDescription" className="text-sm font-medium">
                Description (optional)
              </label>
              <Input
                id="newDescription"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What is this list about?"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <Select value={newVisibility} onValueChange={setNewVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError !== null && <p className="text-sm text-destructive">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create List"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/$platform/")({
  component: PlatformPage,
});
