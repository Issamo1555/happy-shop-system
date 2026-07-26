import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { 
  ShoppingBag, Users, Calendar, Receipt, LogOut, Package, HardDrive, 
  Database, User, Camera, Settings, LayoutDashboard, LifeBuoy, 
  Building2, PhoneCall, Menu, FileText, Shield
} from "lucide-react";
import { toast } from "sonner";
import { downloadDatabaseAction } from "@/lib/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/dashboard", label: "Bureau", icon: LayoutDashboard },
  { to: "/caisse", label: "Caisse", icon: ShoppingBag, module: "caisse" },
  { to: "/catalogue", label: "Catalogue", icon: Package, module: "catalogue" },
  { to: "/clients", label: "Clients", icon: Users, module: "clients" },
  { to: "/agenda", label: "Agenda", icon: Calendar, module: "agenda" },
  { to: "/historique", label: "Historique", icon: Receipt, module: "historique" },
  { to: "/tickets", label: "Tickets", icon: LifeBuoy, module: "tickets" },
  { to: "/settings", label: "Paramètres", icon: Settings, adminOnly: true },
  { to: "/db-admin", label: "Base de données", icon: Database, superAdminOnly: true },
  { to: "/admin-tenants", label: "Centres (Tenants)", icon: Building2, superAdminOnly: true },
  { to: "/access-logs", label: "Logs d'accès", icon: Shield, superAdminOnly: true },
  { to: "/crm", label: "Prospection", icon: PhoneCall, crmAccessOnly: true, module: "crm" },
  { to: "/guide-stage", label: "Programme Stage", icon: FileText, crmAccessOnly: true, module: "crm" },
] as const;

export function AppSidebar() {
  const { user, roles, isAdmin, isSuperAdmin, signOut, updateProfile, uploadAvatar } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setFullName(user.full_name || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user, showProfile]);

  const handleUpdateProfile = async () => {
    setSubmitting(true);
    try {
      await updateProfile(email, fullName, avatarUrl);
      toast.success("Profil mis à jour");
      setShowProfile(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image est trop lourde (max 2Mo)");
      return;
    }

    setSubmitting(true);
    try {
      await uploadAvatar(file);
      toast.success("Photo mise à jour !");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("À bientôt");
    navigate({ to: "/login" });
  };

  const handleBackup = async () => {
    try {
      const { content, filename } = await downloadDatabaseAction({ data: { adminId: user?.id || "" } });
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border w-64 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/50">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
          {user?.tenant_logo ? (
            <img src={user.tenant_logo} alt="Logo" className="w-10 h-10 drop-shadow-sm rounded-md" />
          ) : (
            <img src={logo} alt="Logo" className="w-10 h-10 drop-shadow-sm" />
          )}
          <div>
            <p className="font-display text-lg leading-none" style={{ color: user?.tenant_color || "var(--primary)" }}>
              {user?.tenant_name || "Mums'Home"}
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          if ((item as any).superAdminOnly && !isSuperAdmin) return null;
          if ((item as any).crmAccessOnly && user?.role !== 'super_admin' && user?.role !== 'sales') return null;
          
          // Check if module is enabled for the current tenant
          if ((item as any).module && user?.enabled_modules && !user.enabled_modules.includes((item as any).module)) {
            return null;
          }

          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              activeProps={{ className: "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary-soft text-primary" }}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50 space-y-4 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackup} title="Sauvegarder la base de données">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Se déconnecter" className="text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <Dialog open={showProfile} onOpenChange={setShowProfile}>
          <DialogTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-card hover:bg-accent cursor-pointer transition-colors border border-border/50 shadow-sm">
              <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url.startsWith('http') ? user.avatar_url : `${user.avatar_url}?t=${Date.now()}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{user?.full_name || user?.email}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate mt-1">
                  {roles.join(", ") || "—"}
                </p>
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-primary">Mon Profil</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center justify-center gap-4 mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl bg-primary/5">
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url.startsWith('http') ? user.avatar_url : `${user.avatar_url}?t=${Date.now()}`} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary/30 text-2xl font-bold bg-primary/10">
                        {user?.full_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera size={24} />
                    <input 
                      id="avatar-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                      disabled={submitting}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {submitting ? "Téléchargement..." : "Cliquez sur l'image pour changer"}
                </p>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="profile-avatar">URL de l'image (optionnel)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="profile-avatar" 
                    value={avatarUrl} 
                    onChange={(e) => setAvatarUrl(e.target.value)} 
                    placeholder="https://..."
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-name">Nom complet</Label>
                <Input 
                  id="profile-name" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Votre nom"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-email">Email</Label>
                <Input 
                  id="profile-email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleUpdateProfile}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "Mise à jour..." : "Enregistrer les modifications"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 z-50">
        <SidebarContent />
      </div>

      {/* Mobile Top Header (only visible on small screens) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-16 bg-card border-b border-border shadow-sm w-full">
        <div className="flex items-center gap-3">
          {user?.tenant_logo ? (
            <img src={user.tenant_logo} alt="Logo" className="w-8 h-8 drop-shadow-sm rounded-md" />
          ) : (
            <img src={logo} alt="Logo" className="w-8 h-8 drop-shadow-sm" />
          )}
          <p className="font-display text-lg leading-none" style={{ color: user?.tenant_color || "var(--primary)" }}>
            {user?.tenant_name || "Mums'Home"}
          </p>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SheetHeader className="hidden">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
