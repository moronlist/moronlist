import { RouterProvider, createRouter } from "@tanstack/react-router";
import { AuthProvider } from "./contexts/AuthContext.js";
import { routeTree } from "./routeTree.gen.js";

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div className="container page-spacing text-center">
      <h2 className="mb-4">Page not found</h2>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
