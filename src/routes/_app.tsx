import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { CartProvider } from "@/lib/cart-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, loading, isStaff } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-2xl text-muted-foreground animate-pulse">
          Chargement...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center pos-card p-8">
          <h1 className="font-display text-2xl text-primary mb-2">Accès en attente</h1>
          <p className="text-muted-foreground">
            Votre compte n'a pas encore de rôle assigné. Contactez l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </CartProvider>
  );
}
