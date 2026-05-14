import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Users, Calendar, Receipt, LogOut, Package, HardDrive, Database, User, Camera, Upload, Settings } from "lucide-react";
import { toast } from "sonner";
import { downloadDatabaseAction } from "@/lib/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/caisse", label: "Caisse", icon: ShoppingBag },
  { to: "/catalogue", label: "Catalogue", icon: Package },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/historique", label: "Historique", icon: Receipt },
  { to: "/settings", label: "Paramètres", icon: Settings, adminOnly: true },
  { to: "/db-admin", label: "Base de données", icon: Database, adminOnly: true },
] as const;

export function AppHeader() {
  const { user, roles, isAdmin, signOut, updateProfile, uploadAvatar } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    
    // Check file size (max 2MB)
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
          
          <Dialog open={showProfile} onOpenChange={setShowProfile}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Mon Profil" className="relative w-10 h-10 rounded-full overflow-hidden border border-border/50">
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
              </Button>
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

          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
