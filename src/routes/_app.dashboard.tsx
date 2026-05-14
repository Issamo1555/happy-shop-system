import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ShoppingBag, Package, Users, Calendar, Receipt, Settings, Database, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { isAdmin } = useAuth();

  const menuItems = [
    { to: "/caisse", label: "Caisse", icon: ShoppingBag, color: "bg-primary/10 text-primary", description: "Interface de vente et encaissement" },
    { to: "/catalogue", label: "Catalogue", icon: Package, color: "bg-sage/10 text-sage", description: "Gestion des produits et catégories" },
    { to: "/clients", label: "Clients", icon: Users, color: "bg-blue-100 text-blue-600", description: "Gestion de la base client" },
    { to: "/agenda", label: "Agenda", icon: Calendar, color: "bg-purple-100 text-purple-600", description: "Planning des rendez-vous" },
    { to: "/historique", label: "Historique", icon: Receipt, color: "bg-orange-100 text-orange-600", description: "Suivi des ventes et rapports" },
    { to: "/settings", label: "Paramètres", icon: Settings, color: "bg-gray-100 text-gray-600", description: "Configuration de l'établissement", adminOnly: true },
    { to: "/db-admin", label: "Base de données", icon: Database, color: "bg-red-100 text-red-600", description: "Maintenance technique", adminOnly: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-display text-primary flex items-center justify-center gap-3">
          <LayoutDashboard className="w-10 h-10" />
          Bureau Principal
        </h1>
        <p className="text-muted-foreground">Bienvenue dans votre interface de gestion Mums'Home.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {menuItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="group">
              <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-card shadow-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className={`w-20 h-20 rounded-2xl ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-display font-bold">{item.label}</h2>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      
      <footer className="pt-12 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Mums'Home POS — Système de Gestion Intégré</p>
      </footer>
    </div>
  );
}
