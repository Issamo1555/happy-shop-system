import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTenantsAction, createTenantAction, updateTenantAction, toggleTenantActiveAction, seedTenantDataAction, getTenantUsersAction, deleteTenantUserAction, resetTenantUserPasswordAction, exportDatabaseAction, importDatabaseAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Search, Settings, Building, MapPin, DatabaseZap, Users, Trash2, Key, Check, X, Tag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingOffersAdmin } from "@/components/PricingOffersAdmin";

export const Route = createFileRoute("/_app/admin-tenants")({
  component: AdminTenantsPage,
});

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  invite_code: string | null;
  active: boolean;
  created_at: string;
  users_count?: number;
  clients_count?: number;
  total_sales?: number;
}

function AdminTenantsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Users Management State
  const [usersOpen, setUsersOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Seeder State
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedingTenant, setSeedingTenant] = useState<Tenant | null>(null);
  const [seedPrefix, setSeedPrefix] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#D4A574");
  const [inviteCode, setInviteCode] = useState("");
  const [active, setActive] = useState(true);

  // Admin User (for creation only)
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-500">Accès refusé. Droits Super-Admin requis.</div>;
  }

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await getTenantsAction({ data: { userId: user.id } });
      setTenants(data);
    } catch (err: any) {
      toast.error(err.message || "Erreur de changement de statut");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSeed = (t: Tenant) => {
    setSeedingTenant(t);
    // Generate default prefix like "[C1]" from name "Centre 1"
    const prefix = `[${t.name.substring(0, 2).toUpperCase()}]`;
    setSeedPrefix(prefix);
    setSeedOpen(true);
  };

  const handleOpenUsers = async (t: Tenant) => {
    setSelectedTenant(t);
    setUsersOpen(true);
    setLoadingUsers(true);
    try {
      const data = await getTenantUsersAction({ data: { tenantId: t.id, userId: user.id } });
      setTenantUsers(data);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement des utilisateurs");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.")) return;
    try {
      await deleteTenantUserAction({ data: { targetUserId, userId: user.id } });
      toast.success("Utilisateur supprimé");
      setTenantUsers(tenantUsers.filter(u => u.id !== targetUserId));
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    }
  };

  const handleResetPassword = async (targetUserId: string) => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    try {
      await resetTenantUserPasswordAction({ data: { targetUserId, newPassword, userId: user.id } });
      toast.success("Mot de passe réinitialisé");
      setResettingUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur de réinitialisation");
    }
  };

  const handleSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedingTenant || !seedPrefix) return;
    
    setIsSeeding(true);
    try {
      await seedTenantDataAction({
        data: {
          tenantId: seedingTenant.id,
          prefix: seedPrefix,
          adminId: user.id
        }
      });
      toast.success(`Données de test (${seedPrefix}) générées avec succès !`);
      setSeedOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la génération");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleOpenNew = () => {
    setEditing(null);
    setName("");
    setLogoUrl("");
    setPrimaryColor("#D4A574");
    setInviteCode("");
    setActive(true);
    setAdminEmail("");
    setAdminPassword("");
    setAdminName("");
    setOpen(true);
  };

  const handleOpenEdit = (t: Tenant) => {
    setEditing(t);
    setName(t.name);
    setLogoUrl(t.logo_url || "");
    setPrimaryColor(t.primary_color || "#D4A574");
    setInviteCode(t.invite_code || "");
    setActive(t.active);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    setSubmitting(true);
    try {
      if (editing) {
        await updateTenantAction({
          data: {
            userId: user.id,
            id: editing.id,
            name,
            logo_url: logoUrl,
            primary_color: primaryColor,
            invite_code: inviteCode,
            active
          }
        });
        toast.success("Centre mis à jour");
      } else {
        await createTenantAction({
          data: {
            userId: user.id,
            name,
            logo_url: logoUrl,
            primary_color: primaryColor,
            invite_code: inviteCode,
            active,
            admin_email: adminEmail,
            admin_password: adminPassword,
            admin_name: adminName
          }
        });
        toast.success("Centre créé avec son administrateur !");
      }
      setOpen(false);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await toggleTenantActiveAction({ data: { id, active: !currentActive, userId: user.id } });
      toast.success(currentActive ? "Centre désactivé" : "Centre activé");
      fetchTenants();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    }
  };

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Tabs defaultValue="centres" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="centres" className="gap-2">
            <Building2 className="w-4 h-4" />
            Centres Clients
          </TabsTrigger>
          <TabsTrigger value="offres" className="gap-2">
            <Tag className="w-4 h-4" />
            Abonnements (SaaS)
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <DatabaseZap className="w-4 h-4" />
            Base de données
          </TabsTrigger>
        </TabsList>

        <TabsContent value="centres" className="space-y-6 mt-0">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-display text-primary flex items-center gap-3">
                <Building2 className="w-8 h-8" />
                Gestion des Centres (Tenants)
              </h1>
              <p className="text-muted-foreground mt-1">
                Super-Administration : Gérez les différents établissements utilisant la plateforme.
              </p>
            </div>

        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNew} className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              Nouveau Centre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
                <Building className="w-5 h-5" />
                {editing ? "Modifier le Centre" : "Créer un Centre"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2 uppercase tracking-wider">Identité du Centre</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="t-name">Nom de l'établissement *</Label>
                    <Input id="t-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Mums'Home Paris" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-color">Couleur Principale</Label>
                    <div className="flex gap-2">
                      <Input id="t-color" type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 p-1 h-10" />
                      <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#HEXCODE" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-logo">URL du Logo</Label>
                  <Input id="t-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="t-invite">Code d'invitation Staff</Label>
                    <Input id="t-invite" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Ex: MUMSPARIS2026" />
                    <p className="text-[10px] text-muted-foreground">Code requis pour l'inscription des caissiers de ce centre.</p>
                  </div>
                  <div className="space-y-2 flex items-center gap-3 pt-6 border-l pl-4">
                    <Switch id="t-active" checked={active} onCheckedChange={setActive} />
                    <Label htmlFor="t-active" className="cursor-pointer">Centre Actif</Label>
                  </div>
                </div>
              </div>

              {!editing && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2 uppercase tracking-wider">Compte Administrateur Initial</h3>
                  <div className="bg-primary/5 p-4 rounded-xl space-y-4 border border-primary/10">
                    <div className="space-y-2">
                      <Label htmlFor="a-name">Nom complet de l'Admin</Label>
                      <Input id="a-name" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ex: Jean Dupont" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="a-email">Email Admin *</Label>
                        <Input id="a-email" type="email" required={!editing} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@centre.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-pwd">Mot de passe *</Label>
                        <Input id="a-pwd" type="text" required={!editing} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Minimum 6 caractères" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Cet utilisateur aura les droits complets pour configurer les produits, clients et paramètres de ce centre.</p>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enregistrement..." : (editing ? "Mettre à jour" : "Créer le Centre")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input 
          placeholder="Rechercher un centre par nom ou slug..." 
          className="pl-10 max-w-md bg-white/50 backdrop-blur-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Centre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Statistiques</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun centre trouvé</TableCell>
              </TableRow>
            ) : filtered.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.name} className="w-8 h-8 rounded-md object-cover border" />
                    ) : (
                      <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white shadow-inner" style={{ backgroundColor: t.primary_color || '#ccc' }}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground">ID: {t.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{t.slug}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <div><span className="font-medium text-foreground">{t.users_count || 0}</span> utilisateurs</div>
                    <div><span className="font-medium text-foreground">{t.clients_count || 0}</span> clients</div>
                    <div><span className="font-medium text-primary">{t.total_sales || 0} DHS</span> CA</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={t.active} 
                      onCheckedChange={() => handleToggleActive(t.id, t.active)}
                    />
                    <Badge variant={t.active ? "default" : "secondary"} className={t.active ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}>
                      {t.active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => handleOpenUsers(t)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                    <Users className="w-4 h-4 mr-2" />
                    Personnel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenSeed(t)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                    <DatabaseZap className="w-4 h-4 mr-2" />
                    Tests
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(t)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* SEEDER DIALOG */}
      <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <DatabaseZap className="w-5 h-5 text-blue-500" />
              Générer des Données de Test
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSeed} className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Cette action va injecter des clients, des produits, des rendez-vous et des ventes factices dans le centre <strong>{seedingTenant?.name}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="s-prefix">Préfixe visuel *</Label>
              <Input 
                id="s-prefix" 
                required 
                value={seedPrefix} 
                onChange={e => setSeedPrefix(e.target.value)} 
                placeholder="Ex: [C1]" 
              />
              <p className="text-xs text-muted-foreground">
                Toutes les données créées commenceront par ce préfixe pour vous aider à les identifier (ex: {seedPrefix} Client 1).
              </p>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setSeedOpen(false)} disabled={isSeeding}>Annuler</Button>
              <Button type="submit" disabled={isSeeding} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSeeding ? "Génération en cours..." : "Générer les tests"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* USERS MODAL */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <Users className="w-5 h-5" />
              Personnel de : {selectedTenant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 mb-4 bg-muted/50 p-3 rounded-lg border">
              <Label className="text-sm">Code d'invitation Staff :</Label>
              <Badge variant="outline" className="font-mono">{selectedTenant?.invite_code || "Aucun défini"}</Badge>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4">Chargement...</TableCell></TableRow>
                  ) : tenantUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
                  ) : (
                    tenantUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {resettingUser === u.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input 
                                type="password" 
                                placeholder="Nouveau mdp..." 
                                className="h-8 w-32 text-xs" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                              />
                              <Button size="sm" variant="default" onClick={() => handleResetPassword(u.id)} className="h-8 w-8 p-0">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setResettingUser(null)} className="h-8 w-8 p-0 text-muted-foreground">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => { setResettingUser(u.id); setNewPassword(""); }}
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.id === user.id}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="offres" className="mt-0">
          <PricingOffersAdmin userId={user.id} />
        </TabsContent>

        <TabsContent value="database" className="mt-0">
          <DatabaseTab userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DatabaseTab({ userId }: { userId: string }) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportDatabaseAction({ data: { userId } });
      
      const blob = new Blob([Uint8Array.from(atob(res.base64), c => c.charCodeAt(0))], { type: 'application/x-sqlite3' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `pos_backup_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Base de données exportée avec succès !");
    } catch (err: any) {
      toast.error("Erreur lors de l'exportation : " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Attention ! L'importation d'une base de données va écraser TOUTES les données actuelles de l'application. Cette action est irréversible. Voulez-vous continuer ?")) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        try {
          await importDatabaseAction({ data: { userId, base64 } });
          toast.success("Base de données restaurée avec succès ! L'application va se recharger.");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err: any) {
          toast.error(err.message || "Erreur lors de la restauration.");
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error("Erreur de lecture du fichier: " + err.message);
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <DatabaseZap className="w-5 h-5 text-primary" />
          Sauvegarde & Restauration de la Base de Données
        </CardTitle>
        <CardDescription>
          Gérez la base de données SQLite globale de l'application. Exportez vos données pour les sauvegarder ou importez un fichier de sauvegarde antérieur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-5 space-y-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              📤 Exporter les données
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Télécharge le fichier de base de données complet (<code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">pos.db</code>). 
              Ce fichier contient tous les centres clients, abonnements, ventes, tickets et configurations de l'application.
            </p>
            <Button 
              onClick={handleExport} 
              disabled={exporting}
              className="w-full sm:w-auto"
            >
              {exporting ? "Exportation..." : "Télécharger la Sauvegarde (.db)"}
            </Button>
          </div>

          <div className="border rounded-xl p-5 space-y-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              📥 Restaurer une sauvegarde
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sélectionnez un fichier <code className="bg-slate-100 px-1 py-0.5 rounded text-red-700 font-mono">.db</code> précédemment exporté. 
              <strong>Attention :</strong> Toutes les données actuelles seront entièrement remplacées par celles du fichier importé.
            </p>
            
            <div className="relative">
              <input
                type="file"
                accept=".db"
                onChange={handleImport}
                disabled={importing}
                id="database-file-upload"
                className="hidden"
              />
              <Label 
                htmlFor="database-file-upload"
                className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2 cursor-pointer w-full sm:w-auto ${importing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {importing ? "Restauration en cours..." : "Sélectionner et Importer un fichier (.db)"}
              </Label>
            </div>
          </div>
        </div>

        <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-4 flex gap-3 text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-amber-800">Recommandation de Sécurité</h4>
            <p className="leading-relaxed">
              Il est recommandé de faire un export régulier de votre base de données avant toute mise à jour système importante. 
              Le système de restauration possède un mécanisme de sécurité automatique : si le fichier importé est invalide ou corrompu, le système annulera l'action et restaurera automatiquement votre base de données précédente pour éviter toute perte de données.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
