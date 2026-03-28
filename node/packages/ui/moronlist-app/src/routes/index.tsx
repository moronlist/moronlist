import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { popularOnPlatform, type MoronList } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, Shield, GitFork } from "lucide-react";

function HomePage() {
  const [popularLists, setPopularLists] = useState<MoronList[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);

  useEffect(() => {
    async function loadPopular() {
      try {
        const result = await popularOnPlatform("x", 0, 6);
        setPopularLists(result.lists);
      } catch {
        // Silently fail on home page
      } finally {
        setIsLoadingPopular(false);
      }
    }
    void loadPopular();
  }, []);

  return (
    <div className="content-spacing">
      {/* Hero */}
      <section className="container py-16 md:py-24 text-center">
        <h1 className="text-display-lg md:text-display-xl mb-6 text-balance">
          Collaborative Block Lists
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-balance">
          Create, share, and subscribe to curated block lists. Keep your feed clean by leveraging
          the collective wisdom of the community.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/$platform" params={{ platform: "x" }}>
            <Button size="lg">
              Browse X Lists
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border p-6">
            <CardContent>
              <Users className="h-8 w-8 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Community Curated</h3>
              <p className="text-sm text-muted-foreground">
                Lists are created and maintained by real people who care about keeping their corners
                of the internet healthy.
              </p>
            </CardContent>
          </Card>
          <Card className="border p-6">
            <CardContent>
              <Shield className="h-8 w-8 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Saints and Morons</h3>
              <p className="text-sm text-muted-foreground">
                Every list has a block list (morons) and a safe list (saints). Nuance matters -- not
                everyone is all bad.
              </p>
            </CardContent>
          </Card>
          <Card className="border p-6">
            <CardContent>
              <GitFork className="h-8 w-8 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Fork and Inherit</h3>
              <p className="text-sm text-muted-foreground">
                Fork lists to make your own version. Set parent lists to inherit entries
                automatically. Build on each other.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platforms */}
      <section className="container">
        <h2 className="text-heading mb-6">Platforms</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link to="/$platform" params={{ platform: "x" }} className="no-underline">
            <Card className="border p-6 hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="mb-0">
                <CardTitle className="text-xl">X (Twitter)</CardTitle>
                <CardDescription>Block lists for X / Twitter</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>

      {/* Popular Lists */}
      <section className="container">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading">Popular Lists</h2>
          <Link to="/$platform" params={{ platform: "x" }}>
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
        {isLoadingPopular ? (
          <div className="grid-lists gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : popularLists.length > 0 ? (
          <div className="grid-lists gap-4">
            {popularLists.map((list) => (
              <Link
                key={list.id}
                to="/$platform/$slug"
                params={{ platform: list.platform, slug: list.slug }}
                className="no-underline"
              >
                <Card className="border p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold leading-tight">{list.name}</h3>
                    <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                      {list.platform}
                    </Badge>
                  </div>
                  {list.description !== null && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">by {list.ownerId}</p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No lists yet. Be the first to create one.</p>
        )}
      </section>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
