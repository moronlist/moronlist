import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  fetchMoronList,
  fetchEntries,
  fetchSaints,
  fetchParents,
  fetchChangelog,
  addEntry,
  removeEntry,
  addSaint,
  removeSaint,
  subscribe,
  unsubscribe,
  updateMoronList,
  deleteMoronList,
  forkMoronList,
  type MoronListDetail,
  type MoronEntry,
  type SaintEntry,
  type Parent,
  type ChangelogEntry,
} from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Star,
  GitFork,
  Users,
  Shield,
  Clock,
  Trash2,
  Plus,
  Settings,
  ArrowLeft,
} from "lucide-react";

function ListDetailPage() {
  const { platform, slug } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [list, setList] = useState<MoronListDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab data
  const [entries, setEntries] = useState<MoronEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [saints, setSaints] = useState<SaintEntry[]>([]);
  const [saintsTotal, setSaintsTotal] = useState(0);
  const [parents, setParents] = useState<Parent[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  // Add entry form
  const [newEntryUserId, setNewEntryUserId] = useState("");
  const [newEntryDisplayName, setNewEntryDisplayName] = useState("");
  const [newEntryReason, setNewEntryReason] = useState("");
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  // Add saint form
  const [newSaintUserId, setNewSaintUserId] = useState("");
  const [newSaintReason, setNewSaintReason] = useState("");
  const [isAddingSaint, setIsAddingSaint] = useState(false);

  // Fork dialog
  const [showFork, setShowFork] = useState(false);
  const [forkSlug, setForkSlug] = useState("");
  const [forkName, setForkName] = useState("");
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  // Edit dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscription loading
  const [isSubscribing, setIsSubscribing] = useState(false);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMoronList(platform, slug);
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setIsLoading(false);
    }
  }, [platform, slug]);

  const loadEntries = useCallback(async () => {
    try {
      const result = await fetchEntries(platform, slug);
      setEntries(result.entries);
      setEntriesTotal(result.total);
    } catch {
      // Ignore
    }
  }, [platform, slug]);

  const loadSaints = useCallback(async () => {
    try {
      const result = await fetchSaints(platform, slug);
      setSaints(result.saints);
      setSaintsTotal(result.total);
    } catch {
      // Ignore
    }
  }, [platform, slug]);

  const loadParents = useCallback(async () => {
    try {
      const data = await fetchParents(platform, slug);
      setParents(data);
    } catch {
      // Ignore
    }
  }, [platform, slug]);

  const loadChangelog = useCallback(async () => {
    try {
      const result = await fetchChangelog(platform, slug);
      setChangelog(result.changelog);
    } catch {
      // Ignore
    }
  }, [platform, slug]);

  useEffect(() => {
    void loadList();
    void loadEntries();
    void loadSaints();
    void loadParents();
    void loadChangelog();
  }, [loadList, loadEntries, loadSaints, loadParents, loadChangelog]);

  const handleSubscribe = async () => {
    if (list === null) return;
    setIsSubscribing(true);
    try {
      if (list.isSubscribed) {
        await unsubscribe(platform, slug);
        setList({ ...list, isSubscribed: false, subscriberCount: list.subscriberCount - 1 });
      } else {
        await subscribe(platform, slug);
        setList({ ...list, isSubscribed: true, subscriberCount: list.subscriberCount + 1 });
      }
    } catch {
      // Ignore
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEntryUserId.trim().length === 0) return;
    setIsAddingEntry(true);
    try {
      await addEntry(platform, slug, {
        platformUserId: newEntryUserId.trim(),
        displayName: newEntryDisplayName.trim() || undefined,
        reason: newEntryReason.trim() || undefined,
      });
      setNewEntryUserId("");
      setNewEntryDisplayName("");
      setNewEntryReason("");
      void loadEntries();
      void loadChangelog();
    } catch {
      // Ignore
    } finally {
      setIsAddingEntry(false);
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    try {
      await removeEntry(platform, slug, entryId);
      void loadEntries();
      void loadChangelog();
    } catch {
      // Ignore
    }
  };

  const handleAddSaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSaintUserId.trim().length === 0) return;
    setIsAddingSaint(true);
    try {
      await addSaint(platform, slug, {
        platformUserId: newSaintUserId.trim(),
        reason: newSaintReason.trim() || undefined,
      });
      setNewSaintUserId("");
      setNewSaintReason("");
      void loadSaints();
      void loadChangelog();
    } catch {
      // Ignore
    } finally {
      setIsAddingSaint(false);
    }
  };

  const handleRemoveSaint = async (saintId: string) => {
    try {
      await removeSaint(platform, slug, saintId);
      void loadSaints();
      void loadChangelog();
    } catch {
      // Ignore
    }
  };

  const handleFork = async (e: React.FormEvent) => {
    e.preventDefault();
    setForkError(null);
    setIsForking(true);
    try {
      const forked = await forkMoronList(platform, slug, {
        slug: forkSlug.trim().toLowerCase(),
        name: forkName.trim() || undefined,
      });
      setShowFork(false);
      void navigate({
        to: "/$platform/$slug",
        params: { platform: forked.platform, slug: forked.slug },
      });
    } catch (err) {
      setForkError(err instanceof Error ? err.message : "Failed to fork list");
    } finally {
      setIsForking(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setIsEditing(true);
    try {
      const updated = await updateMoronList(platform, slug, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        visibility: editVisibility || undefined,
      });
      setShowEdit(false);
      setList((prev) =>
        prev !== null
          ? {
              ...prev,
              name: updated.name,
              description: updated.description,
              visibility: updated.visibility,
            }
          : null
      );
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update list");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMoronList(platform, slug);
      void navigate({ to: "/$platform", params: { platform } });
    } catch {
      // Ignore
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container page-spacing">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error !== null || list === null) {
    return (
      <div className="container page-spacing text-center">
        <h2 className="mb-4">List not found</h2>
        <p className="text-muted-foreground mb-4">
          {error ?? "The list you are looking for does not exist."}
        </p>
        <Link to="/$platform" params={{ platform }}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {platform}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container page-spacing content-spacing">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/$platform" params={{ platform }} className="hover:text-foreground no-underline">
          {platform}
        </Link>
        <span>/</span>
        <span className="text-foreground">{slug}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-display">{list.name}</h2>
            <Badge variant="secondary">{list.visibility}</Badge>
            {list.forkedFrom !== null && (
              <Badge variant="outline">forked from {list.forkedFrom}</Badge>
            )}
          </div>
          {list.description !== null && <p className="text-muted-foreground">{list.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <Link
              to="/user/$userId"
              params={{ userId: list.ownerId }}
              className="hover:text-foreground no-underline"
            >
              @{list.ownerId}
            </Link>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {list.entryCount} entries
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              {list.saintCount} saints
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {list.subscriberCount} subscribers
            </span>
            <span>v{list.version}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && !list.isOwner && (
            <Button
              variant={list.isSubscribed ? "outline" : "default"}
              onClick={() => void handleSubscribe()}
              disabled={isSubscribing}
            >
              <Star className="h-4 w-4 mr-1" />
              {list.isSubscribed ? "Subscribed" : "Subscribe"}
            </Button>
          )}
          {isAuthenticated && !list.isOwner && (
            <Button variant="outline" onClick={() => setShowFork(true)}>
              <GitFork className="h-4 w-4 mr-1" />
              Fork
            </Button>
          )}
          {list.isOwner && (
            <Button
              variant="outline"
              onClick={() => {
                setEditName(list.name);
                setEditDescription(list.description ?? "");
                setEditVisibility(list.visibility);
                setShowEdit(true);
              }}
            >
              <Settings className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Entries ({entriesTotal})</TabsTrigger>
          <TabsTrigger value="saints">Saints ({saintsTotal})</TabsTrigger>
          <TabsTrigger value="parents">Parents ({parents.length})</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          {list.isOwner && (
            <form
              onSubmit={(e) => void handleAddEntry(e)}
              className="flex flex-col sm:flex-row gap-2 p-4 border rounded-md bg-muted/30"
            >
              <Input
                value={newEntryUserId}
                onChange={(e) => setNewEntryUserId(e.target.value)}
                placeholder="Platform user ID (e.g. @username)"
                className="flex-1"
                disabled={isAddingEntry}
              />
              <Input
                value={newEntryDisplayName}
                onChange={(e) => setNewEntryDisplayName(e.target.value)}
                placeholder="Display name (optional)"
                className="flex-1"
                disabled={isAddingEntry}
              />
              <Input
                value={newEntryReason}
                onChange={(e) => setNewEntryReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1"
                disabled={isAddingEntry}
              />
              <Button type="submit" disabled={isAddingEntry} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </form>
          )}
          {entries.length > 0 ? (
            <div className="space-y-1">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{entry.platformUserId}</span>
                      {entry.displayName !== null && (
                        <span className="text-sm text-muted-foreground">({entry.displayName})</span>
                      )}
                    </div>
                    {entry.reason !== null && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.reason}</p>
                    )}
                  </div>
                  {list.isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void handleRemoveEntry(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No entries yet.</p>
          )}
        </TabsContent>

        {/* Saints Tab */}
        <TabsContent value="saints" className="space-y-4">
          {list.isOwner && (
            <form
              onSubmit={(e) => void handleAddSaint(e)}
              className="flex flex-col sm:flex-row gap-2 p-4 border rounded-md bg-muted/30"
            >
              <Input
                value={newSaintUserId}
                onChange={(e) => setNewSaintUserId(e.target.value)}
                placeholder="Platform user ID (e.g. @username)"
                className="flex-1"
                disabled={isAddingSaint}
              />
              <Input
                value={newSaintReason}
                onChange={(e) => setNewSaintReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1"
                disabled={isAddingSaint}
              />
              <Button type="submit" disabled={isAddingSaint} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Saint
              </Button>
            </form>
          )}
          {saints.length > 0 ? (
            <div className="space-y-1">
              {saints.map((saint) => (
                <div
                  key={saint.id}
                  className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{saint.platformUserId}</span>
                    {saint.reason !== null && (
                      <p className="text-xs text-muted-foreground mt-0.5">{saint.reason}</p>
                    )}
                  </div>
                  {list.isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void handleRemoveSaint(saint.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No saints yet.</p>
          )}
        </TabsContent>

        {/* Parents Tab */}
        <TabsContent value="parents" className="space-y-4">
          {parents.length > 0 ? (
            <div className="space-y-2">
              {parents.map((parent) => (
                <Link
                  key={parent.id}
                  to="/$platform/$slug"
                  params={{ platform: parent.platform, slug: parent.slug }}
                  className="block p-3 border rounded-md hover:bg-muted/50 no-underline transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{parent.name ?? parent.id}</span>
                      <p className="text-xs text-muted-foreground">{parent.id}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              This list has no parent lists.
            </p>
          )}
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="space-y-4">
          {changelog.length > 0 ? (
            <div className="space-y-1">
              {changelog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-2 px-3 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Badge
                    variant={entry.action.includes("REMOVE") ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {entry.action}
                  </Badge>
                  <span className="font-medium">{entry.platformUserId}</span>
                  <span className="text-muted-foreground">v{entry.version}</span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No changelog entries yet.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Fork Dialog */}
      <Dialog open={showFork} onOpenChange={setShowFork}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork List</DialogTitle>
            <DialogDescription>Create your own copy of &quot;{list.name}&quot;.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleFork(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="forkSlug" className="text-sm font-medium">
                New Slug
              </label>
              <Input
                id="forkSlug"
                value={forkSlug}
                onChange={(e) => setForkSlug(e.target.value)}
                placeholder="e.g. my-version"
                disabled={isForking}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="forkName" className="text-sm font-medium">
                New Name (optional)
              </label>
              <Input
                id="forkName"
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                placeholder={`Default: ${list.name}`}
                disabled={isForking}
              />
            </div>
            {forkError !== null && <p className="text-sm text-destructive">{forkError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFork(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isForking}>
                {isForking ? "Forking..." : "Fork"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>Update your list settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleEdit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="editName" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="editDescription" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <select
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm"
                disabled={isEditing}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
            {editError !== null && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setShowEdit(false);
                  setShowDelete(true);
                }}
              >
                Delete List
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{list.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/$platform/$slug")({
  component: ListDetailPage,
});
