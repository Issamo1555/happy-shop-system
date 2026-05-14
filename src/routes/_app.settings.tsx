import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSettingsAction, updateSettingsAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MapPin, Phone, Mail, Calendar, Percent, Save, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettingsAction();
      setSettings(data as Record<string, string>);
    } catch (err) {
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Accès refusé");
      return;
    }
    setSubmitting(true);
    try {
      await updateSettingsAction({ data: { settings, adminId: user?.id || "" } });
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

      <form onSubmit={handleSave}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="general" className="gap-2"><MapPin className="w-4 h-4" /> Général</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2"><Calendar className="w-4 h-4" /> Google Calendar</TabsTrigger>
            <TabsTrigger value="business" className="gap-2"><Percent className="w-4 h-4" /> Règles Métier</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Phone className="w-3 h-3" /> Téléphone</Label>
                    <Input 
                      value={settings.center_phone || ""} 
                      onChange={e => updateKey("center_phone", e.target.value)} 
                      placeholder="+212..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Mail className="w-3 h-3" /> Email</Label>
                    <Input 
                      value={settings.center_email || ""} 
                      onChange={e => updateKey("center_email", e.target.value)} 
                      placeholder="contact@..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
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
          </TabsContent>

          <TabsContent value="business" className="space-y-6">
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
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-6 border-t mt-8">
          <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
            {submitting ? (
              "Enregistrement..."
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
