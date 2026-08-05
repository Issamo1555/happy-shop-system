import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSettingsAction, updateSettingsAction, getTenantUsersAction, createTenantUserAction, updateUserRoleAction, deleteTenantUserAction, resetTenantUserPasswordAction, updateTenantPublicProfileAction, getTenantPublicProfileAction, uploadGalleryImageAction, deleteGalleryImageAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Settings, MapPin, Phone, Mail, Calendar, Percent, Save, Lock, Users, UserPlus, Trash2, KeyRound, Shield, ShoppingBag, PhoneCall, Pencil, Globe, Copy, CheckCircle2, Facebook, Instagram, Image as ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  super_admin: { label: "Super Admin", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: Shield },
  admin: { label: "Administrateur", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Shield },
  cashier: { label: "Caissier", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: ShoppingBag },
  sales: { label: "Agent Call Center", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: PhoneCall },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] || { label: role, color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: Shield };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [creatingUser, setCreatingUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editRoleTarget, setEditRoleTarget] = useState<any>(null);
  const [editRoleValue, setEditRoleValue] = useState("");
  const [resetPwTarget, setResetPwTarget] = useState<any>(null);
  const [resetPwValue, setResetPwValue] = useState("");

  // Vitrine state
  const [specialty, setSpecialty] = useState(user?.specialty || "");
  const [city, setCity] = useState(user?.city || "");
  const [vitDesc, setVitDesc] = useState(user?.description || "");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [vitrineServices, setVitrineServices] = useState<{name:string, price:string, duration:string}[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [savingVitrine, setSavingVitrine] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchVitrineProfile = async () => {
    if (!user?.tenant_slug) return;
    try {
      const data = await getTenantPublicProfileAction({ data: { slug: user.tenant_slug } }) as any;
      if (data) {
        setSpecialty(data.specialty || "");
        setCity(data.city || "");
        setVitDesc(data.description || "");
        setFacebookUrl(data.facebook_url || "");
        setInstagramUrl(data.instagram_url || "");
        setWhatsappNumber(data.whatsapp_number || "");
        setGoogleMapsUrl(data.google_maps_url || "");
        setVitrineServices(data.services || []);
        setGalleryImages(data.gallery || []);
      }
    } catch(e) {
      console.error(e);
    }
  };


  const handleUploadGalleryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await uploadGalleryImageAction({ data: { userId: user.id, base64, filename: file.name } }) as any;
        setGalleryImages(res.gallery);
        toast.success("Image ajoutée à la galerie");
      } catch(err: any) {
        toast.error(err.message || "Erreur lors de l'upload");
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteGalleryImage = async (url: string) => {
    if (!user?.id) return;
    try {
      const res = await deleteGalleryImageAction({ data: { userId: user.id, url } }) as any;
      setGalleryImages(res.gallery);
      toast.success("Image supprimée");
    } catch(err: any) {
      toast.error(err.message || "Erreur de suppression");
    }
  };

  const addService = () => setVitrineServices([...vitrineServices, {name: "", price: "", duration: ""}]);
  const updateService = (index: number, key: keyof typeof vitrineServices[0], value: string) => {
    const arr = [...vitrineServices];
    arr[index][key] = value;
    setVitrineServices(arr);
  };
  const removeService = (index: number) => {
    setVitrineServices(vitrineServices.filter((_, i) => i !== index));
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettingsAction({ data: { tenantId: user?.tenant_id } }) as any;
      if (data.google_private_key && !data.google_private_key.includes("PRIVATE KEY")) {
        try {
          data.google_private_key = decodeURIComponent(escape(atob(data.google_private_key)));
        } catch (e) {
          // not base64 encoded
        }
      }
      setSettings(data as Record<string, string>);
    } catch (err) {
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    if (!user?.id) return;
    setTeamLoading(true);
    try {
      const data = await getTenantUsersAction({ data: { userId: user.id } });
      setTeamMembers(data as any[]);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement de l'équipe");
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchTeam();
    fetchVitrineProfile();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Accès refusé");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...settings };
      // Encode private key to Base64 to bypass WAF protections on POST requests
      if (payload.google_private_key && payload.google_private_key.includes("PRIVATE KEY")) {
        payload.google_private_key = btoa(unescape(encodeURIComponent(payload.google_private_key)));
      }
      await updateSettingsAction({ data: { settings: payload, adminId: user?.id || "" } });
      toast.success("Paramètres enregistrés");
      await fetchSettings();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const updateKey = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newFullName || !newPassword) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }
    setCreatingUser(true);
    try {
      await createTenantUserAction({ data: { email: newEmail, password: newPassword, fullName: newFullName, role: newRole, userId: user?.id || "" } });
      toast.success(`Compte créé pour ${newFullName}`);
      setShowCreateUser(false);
      setNewEmail(""); setNewFullName(""); setNewPassword(""); setNewRole("cashier");
      await fetchTeam();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTenantUserAction({ data: { targetUserId: deleteTarget.id, userId: user?.id || "" } });
      toast.success(`Compte de ${deleteTarget.full_name} supprimé`);
      setDeleteTarget(null);
      await fetchTeam();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleUpdateRole = async () => {
    if (!editRoleTarget || !editRoleValue) return;
    try {
      await updateUserRoleAction({ data: { targetUserId: editRoleTarget.id, newRole: editRoleValue, userId: user?.id || "" } });
      toast.success(`Rôle de ${editRoleTarget.full_name} mis à jour`);
      setEditRoleTarget(null);
      await fetchTeam();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwTarget || !resetPwValue) return;
    try {
      await resetTenantUserPasswordAction({ data: { targetUserId: resetPwTarget.id, newPassword: resetPwValue, userId: user?.id || "" } });
      toast.success(`Mot de passe de ${resetPwTarget.full_name} réinitialisé`);
      setResetPwTarget(null);
      setResetPwValue("");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement des paramètres...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display text-primary flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Paramètres de l'établissement
        </h1>
        <p className="text-muted-foreground mt-2">Gérez les informations de votre centre, les intégrations et les règles métier.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6" onValueChange={(v) => { if (v === "team") fetchTeam(); }}>
        <TabsList className="flex flex-wrap md:grid md:grid-cols-5 w-full max-w-3xl h-auto">
          <TabsTrigger value="general" className="gap-2"><MapPin className="w-4 h-4" /> Général</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><Calendar className="w-4 h-4" /> Google Calendar</TabsTrigger>
          <TabsTrigger value="business" className="gap-2"><Percent className="w-4 h-4" /> Règles Métier</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Users className="w-4 h-4" /> Équipe</TabsTrigger>
          <TabsTrigger value="vitrine" className="gap-2"><Globe className="w-4 h-4" /> Vitrine</TabsTrigger>
        </TabsList>

        {/* ============ GENERAL TAB ============ */}
        <TabsContent value="general" className="space-y-6">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle>Informations du Centre</CardTitle>
                <CardDescription>Coordonnées affichées sur les reçus et les communications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de l'établissement</Label>
                  <Input 
                    value={settings.center_name || ""} 
                    onChange={e => updateKey("center_name", e.target.value)} 
                    placeholder="Ex: CENTRE DE BIEN-ÊTRE..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Textarea 
                    value={settings.center_address || ""} 
                    onChange={e => updateKey("center_address", e.target.value)} 
                    placeholder="Adresse complète..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-primary">ICE</Label>
                    <Input value={settings.center_ice || ""} onChange={e => updateKey("center_ice", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-primary">Identifiant Fiscal (IF)</Label>
                    <Input value={settings.center_if || ""} onChange={e => updateKey("center_if", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-primary">Registre de Commerce (RC)</Label>
                    <Input value={settings.center_rc || ""} onChange={e => updateKey("center_rc", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-primary">Patente / CNSS</Label>
                    <Input value={settings.center_patente || ""} onChange={e => updateKey("center_patente", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end pt-6">
              <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
                {submitting ? "Enregistrement..." : <><Save className="w-4 h-4" /> Enregistrer les modifications</>}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ============ CALENDAR TAB ============ */}
        <TabsContent value="calendar" className="space-y-6">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Lock className="w-5 h-5" />
                  Configuration API Google Calendar
                </CardTitle>
                <CardDescription>Permet la synchronisation bidirectionnelle des rendez-vous.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Calendar ID</Label>
                  <Input 
                    value={settings.google_calendar_id || ""} 
                    onChange={e => updateKey("google_calendar_id", e.target.value)} 
                    placeholder="primary ou email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email (Service Account)</Label>
                  <Input 
                    value={settings.google_client_email || ""} 
                    onChange={e => updateKey("google_client_email", e.target.value)} 
                    placeholder="service-account@project.iam.gserviceaccount.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Private Key (JSON string)</Label>
                  <Textarea 
                    value={settings.google_private_key || ""} 
                    onChange={e => updateKey("google_private_key", e.target.value)} 
                    placeholder="-----BEGIN PRIVATE KEY-----..."
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end pt-6">
              <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
                {submitting ? "Enregistrement..." : <><Save className="w-4 h-4" /> Enregistrer les modifications</>}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ============ BUSINESS RULES TAB ============ */}
        <TabsContent value="business" className="space-y-6">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle>Règles de Remise</CardTitle>
                <CardDescription>Configurez les remises automatiques pour les membres du réseau.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-8">
                  <div className="space-y-0.5">
                    <Label className="text-base">Remise Membre Réseau</Label>
                    <p className="text-sm text-muted-foreground">Appliquée automatiquement aux clients marqués comme "Adhérent réseau" lors du passage en caisse.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      className="w-24 text-right" 
                      value={settings.member_discount_percent || "0"} 
                      onChange={e => updateKey("member_discount_percent", e.target.value)} 
                    />
                    <span className="font-medium text-lg">%</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 flex items-center justify-between gap-8">
                  <div className="space-y-0.5">
                    <Label className="text-base">Taux de TVA par défaut</Label>
                    <p className="text-sm text-muted-foreground">Utilisé pour calculer le détail HT et TVA sur les tickets de caisse.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      className="w-24 text-right" 
                      value={settings.tva_percent || "20"} 
                      onChange={e => updateKey("tva_percent", e.target.value)} 
                    />
                    <span className="font-medium text-lg">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end pt-6">
              <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
                {submitting ? "Enregistrement..." : <><Save className="w-4 h-4" /> Enregistrer les modifications</>}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ============ TEAM TAB ============ */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Gestion de l'équipe
                </CardTitle>
                <CardDescription>Créez des comptes pour vos employés et assignez-leur des rôles.</CardDescription>
              </div>
              <Button className="gap-2" onClick={() => setShowCreateUser(true)}>
                <UserPlus className="w-4 h-4" />
                Nouveau membre
              </Button>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <p className="text-center text-muted-foreground py-8">Chargement de l'équipe...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun membre trouvé.</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto w-full">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Nom</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Rôle</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {teamMembers.map((member: any) => (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{member.full_name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{member.email}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={member.role} /></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {member.role !== "super_admin" && member.id !== user?.id && (
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier le rôle" onClick={() => { setEditRoleTarget(member); setEditRoleValue(member.role); }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Réinitialiser le mot de passe" onClick={() => { setResetPwTarget(member); setResetPwValue(""); }}>
                                  <KeyRound className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer" onClick={() => setDeleteTarget(member)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                            {member.id === user?.id && (
                              <span className="text-xs text-muted-foreground italic">Vous</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ VITRINE TAB ============ */}
        <TabsContent value="vitrine" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Page Vitrine Publique du Centre
              </CardTitle>
              <CardDescription>
                Configurez les informations visibles par vos clients sur votre page web publique de prise de RDV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Public Link Box */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Votre Lien Public Vitrine</p>
                  <p className="text-sm font-mono text-foreground font-bold">
                    {window.location.origin}/centre/{user?.tenant_slug || "votre-centre"}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/centre/${user?.tenant_slug || "votre-centre"}`;
                      navigator.clipboard.writeText(url);
                      setLinkCopied(true);
                      toast.success("Lien copié dans le presse-papier !");
                      setTimeout(() => setLinkCopied(false), 3000);
                    }}
                    className="gap-2"
                  >
                    {linkCopied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {linkCopied ? "Copié !" : "Copier le lien"}
                  </Button>
                  <a
                    href={`/centre/${user?.tenant_slug || "votre-centre"}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button type="button" size="sm" className="gap-2">
                      Voir ma page ↗
                    </Button>
                  </a>
                </div>
              </div>

              {/* Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user?.id) return;
                  setSavingVitrine(true);
                  try {
                    await updateTenantPublicProfileAction({
                      data: {
                        userId: user.id,
                        specialty,
                        city,
                        description: vitDesc,
                        facebook_url: facebookUrl,
                        instagram_url: instagramUrl,
                        whatsapp_number: whatsappNumber,
                        google_maps_url: googleMapsUrl,
                        vitrine_services: JSON.stringify(vitrineServices),
                        gallery_images: JSON.stringify(galleryImages)
                      }
                    });
                    toast.success("Informations de la vitrine enregistrées avec succès !");
                  } catch (err: any) {
                    toast.error(err.message || "Erreur de sauvegarde");
                  } finally {
                    setSavingVitrine(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="v-spec">Spécialité Principale</Label>
                    <Input
                      id="v-spec"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="Ex : Dentisterie, Pédiatrie, Kinésithérapie..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="v-city">Ville</Label>
                    <Input
                      id="v-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex : Marrakech, Casablanca, Rabat..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="v-desc">Présentation du Centre</Label>
                  <textarea
                    id="v-desc"
                    value={vitDesc}
                    onChange={(e) => setVitDesc(e.target.value)}
                    placeholder="Présentez votre établissement, vos services et votre équipe en quelques lignes..."
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground text-right">{vitDesc.length}/500 caractères</p>
                </div>

                
                {/* Réseaux Sociaux */}
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold mb-4 text-primary">Réseaux Sociaux & Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Facebook className="w-4 h-4"/> Lien Facebook</Label>
                      <Input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Instagram className="w-4 h-4"/> Lien Instagram</Label>
                      <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Phone className="w-4 h-4"/> Numéro WhatsApp</Label>
                      <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="Ex: 0612345678" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><MapPin className="w-4 h-4"/> Lien Google Maps</Label>
                      <Input value={googleMapsUrl} onChange={e => setGoogleMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
                    </div>
                  </div>
                </div>

                {/* Prestations */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-primary">Prestations et Tarifs (Optionnel)</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addService} className="gap-2 text-xs">
                      <Plus className="w-4 h-4" /> Ajouter une prestation
                    </Button>
                  </div>
                  {vitrineServices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune prestation ajoutée. Elles n'apparaîtront pas sur la vitrine.</p>
                  ) : (
                    <div className="space-y-3">
                      {vitrineServices.map((svc, i) => (
                        <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 items-center">
                          <Input value={svc.name} onChange={e => updateService(i, 'name', e.target.value)} placeholder="Nom du service (ex: Consultation)" className="flex-1" />
                          <Input value={svc.price} onChange={e => updateService(i, 'price', e.target.value)} placeholder="Prix (ex: 300 DH)" className="w-32" />
                          <Input value={svc.duration} onChange={e => updateService(i, 'duration', e.target.value)} placeholder="Durée (ex: 30 min)" className="w-32" />
                          <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeService(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Galerie Photos */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-primary">Galerie Photos (Maximum 6)</h3>
                    <div>
                      <Input type="file" id="gallery-upload" className="hidden" accept="image/*" onChange={handleUploadGalleryImage} disabled={uploadingImage || galleryImages.length >= 6} />
                      <Label htmlFor="gallery-upload" className="cursor-pointer">
                        <div className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md ${galleryImages.length >= 6 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}>
                          <ImageIcon className="w-4 h-4" /> {uploadingImage ? "Upload..." : "Ajouter une photo"}
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {galleryImages.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-md border bg-gray-50 overflow-hidden group">
                        <img src={img} alt="Gallery" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleDeleteGalleryImage(img)} className="absolute top-1 right-1 bg-white/80 p-1.5 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={savingVitrine} className="gap-2">
                    <Save className="w-4 h-4" />
                    {savingVitrine ? "Enregistrement..." : "Enregistrer la Vitrine"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ CREATE USER MODAL ============ */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <UserPlus className="w-6 h-6" />
              Ajouter un membre
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Ex: Fatima Zahra" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe temporaire</Label>
              <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 caractères" />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">
                    <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-emerald-600" /> Caissier (POS)</span>
                  </SelectItem>
                  <SelectItem value="sales">
                    <span className="flex items-center gap-2"><PhoneCall className="w-4 h-4 text-blue-600" /> Agent Call Center (CRM)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newRole === "cashier" 
                  ? "Le caissier aura accès à la caisse, l'agenda et les clients." 
                  : "L'agent aura accès uniquement au module de prospection (CRM)."
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>Annuler</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="gap-2">
              {creatingUser ? "Création..." : <><UserPlus className="w-4 h-4" /> Créer le compte</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT ROLE MODAL ============ */}
      <Dialog open={!!editRoleTarget} onOpenChange={() => setEditRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">Modifier le rôle de {editRoleTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={editRoleValue} onValueChange={setEditRoleValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="cashier">Caissier (POS)</SelectItem>
                <SelectItem value="sales">Agent Call Center (CRM)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleTarget(null)}>Annuler</Button>
            <Button onClick={handleUpdateRole}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ RESET PASSWORD MODAL ============ */}
      <Dialog open={!!resetPwTarget} onOpenChange={() => setResetPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Réinitialiser le mot de passe de {resetPwTarget?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input type="text" value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} placeholder="Min. 6 caractères" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwTarget(null)}>Annuler</Button>
            <Button onClick={handleResetPassword} disabled={!resetPwValue || resetPwValue.length < 6}>Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE CONFIRMATION ============ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.full_name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'utilisateur <strong>{deleteTarget?.email}</strong> ne pourra plus se connecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

