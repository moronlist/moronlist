import { useEffect } from "react";
import { createRootRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PERSONA_URL, SITE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, List, Star, Plus } from "lucide-react";

// Pages that don't require onboarding completion
const ONBOARDING_EXEMPT_PATHS = ["/onboarding"];

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, needsOnboarding, user, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const currentPath = location.pathname;

    // If user is authenticated and needs onboarding, redirect to onboarding
    if (isAuthenticated && needsOnboarding) {
      if (!ONBOARDING_EXEMPT_PATHS.includes(currentPath)) {
        void navigate({ to: "/onboarding" });
      }
    }
  }, [isAuthenticated, isLoading, needsOnboarding, location.pathname, navigate]);

  const handleSignIn = () => {
    const returnUrl = `${SITE_URL}${location.pathname}`;
    window.location.href = `${PERSONA_URL}/auth/google?redirect=${encodeURIComponent(returnUrl)}`;
  };

  const handleSignOut = async () => {
    await logout();
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-serif text-xl font-semibold no-underline text-foreground">
              MoronList
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              <Link
                to="/$platform"
                params={{ platform: "x" }}
                className="text-sm text-muted-foreground hover:text-foreground no-underline transition-colors"
              >
                X
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? null : isAuthenticated && user !== null ? (
              <>
                <Link to="/$platform" params={{ platform: "x" }} search={{ create: true }}>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New List
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">@{user.id}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/me/lists" className="no-underline cursor-pointer">
                        <List className="mr-2 h-4 w-4" />
                        My Lists
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/me/subscriptions" className="no-underline cursor-pointer">
                        <Star className="mr-2 h-4 w-4" />
                        Subscriptions
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => void handleSignOut()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={handleSignIn} size="sm">
                Sign In
              </Button>
            )}
          </div>
        </div>
        <Separator />
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>MoronList -- collaborative block lists for the internet.</p>
          <div className="flex items-center gap-4">
            <Link
              to="/$platform"
              params={{ platform: "x" }}
              className="hover:text-foreground no-underline text-muted-foreground"
            >
              Browse X Lists
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
