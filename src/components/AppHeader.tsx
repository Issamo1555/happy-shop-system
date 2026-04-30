import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Users, Calendar, Receipt, LogOut, Package, HardDrive, Database } from "lucide-react";
import { toast } from "sonner";
import { downloadDatabaseAction } from "@/lib/actions";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/caisse", label: "Caisse", icon: ShoppingBag },
  { to: "/catalogue", label: "Catalogue", icon: Package },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/historique", label: "Historique", icon: Receipt },
  { to: "/db-admin", label: "Base de données", icon: Database, adminOnly: true },
] as const;

export function AppHeader() {
  const { user, roles, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("À bientôt");
    navigate({ to: "/login" });
  };

  const handleBackup = async () => {
    try {
      const { content, filename } = await downloadDatabaseAction();
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Sauvegarde réussie");
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-6">
        <Link to="/caisse" className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 drop-shadow-sm" />
          <div className="hidden sm:block">
            <p className="font-display text-lg leading-none text-primary">Mums'Home</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Parentalité & Co</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
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
          <Button variant="ghost" size="icon" onClick={handleBackup} title="Sauvegarder la base de données">
            <HardDrive className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
