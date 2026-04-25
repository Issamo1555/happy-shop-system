import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Users, Calendar, Receipt, LogOut, Package } from "lucide-react";
import { toast } from "sonner";

const navItems = [
  { to: "/caisse", label: "Caisse", icon: ShoppingBag },
  { to: "/catalogue", label: "Catalogue", icon: Package },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/historique", label: "Historique", icon: Receipt },
] as const;

export function AppHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("À bientôt");
    navigate({ to: "/login" });
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-6">
        <Link to="/caisse" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground">
            <Heart className="w-4 h-4" fill="currentColor" />
          </span>
          <div className="hidden sm:block">
            <p className="font-display text-lg leading-none text-primary">Mums'Home</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">POS</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
                activeProps={{ className: "px-3 py-2 rounded-lg text-sm font-medium bg-primary-soft text-primary flex items-center gap-2" }}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block text-right">
            <p className="text-sm font-medium leading-tight">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {roles.join(", ") || "—"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
