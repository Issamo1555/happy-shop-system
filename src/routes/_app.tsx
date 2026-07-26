import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/AppSidebar";
import { CartProvider } from "@/lib/cart-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const moduleRoutes: Record<string, string> = {
  "/caisse": "caisse",
  "/catalogue": "catalogue",
  "/clients": "clients",
  "/agenda": "agenda",
  "/historique": "historique",
  "/tickets": "tickets",
  "/crm": "crm",
  "/guide-stage": "crm",
};

function AppLayout() {
  const { isAuthenticated, loading, isStaff, user } = useAuth();
  const { pathname } = useLocation();

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

  // Route protection for disabled modules
  const matchedRoute = Object.keys(moduleRoutes).find(route => pathname.startsWith(route));
  if (matchedRoute) {
    const requiredModule = moduleRoutes[matchedRoute];
    if (user?.enabled_modules && !user.enabled_modules.includes(requiredModule)) {
      return <Navigate to="/dashboard" />;
    }
  }



  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main className="lg:pl-64 flex flex-col min-h-screen transition-all duration-300">
          <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </CartProvider>
  );
}
