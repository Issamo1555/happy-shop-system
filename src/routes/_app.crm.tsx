import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getProspectsAction, updateProspectStatusAction, assignProspectAction, getSalesAgentsAction } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MapPin, Building2, UserPlus, PhoneCall, MessageSquareText, Search, Filter, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/crm")({
  component: CRMPage,
});

interface Prospect {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  specialty: string;
  status: string;
  assigned_to: string;
  notes: string;
}

interface Agent {
  id: string;
  name: string;
}

function CRMPage() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  const fetchCRMData = async () => {
    try {
      const p = await getProspectsAction({ data: { userId: user.id } });
      setProspects(p);
      
      if (user.role === 'super_admin') {
        const a = await getSalesAgentsAction({ data: { userId: user.id } });
        setAgents(a);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement du CRM");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
  }, [user.id, user.role]);

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    try {
      await updateProspectStatusAction({ data: { userId: user.id, prospectId, status: newStatus } });
      toast.success("Statut mis à jour !");
      fetchCRMData();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    }
  };

  const handleAssignChange = async (prospectId: string, assignedTo: string) => {
    try {
      await assignProspectAction({ data: { userId: user.id, prospectId, assignedTo: assignedTo === 'none' ? null : assignedTo } });
      toast.success("Prospect assigné !");
      fetchCRMData();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nouveau': return 'bg-blue-100 text-blue-800';
      case 'contacté': return 'bg-yellow-100 text-yellow-800';
      case 'intéressé': return 'bg-purple-100 text-purple-800';
      case 'client': return 'bg-green-100 text-green-800';
      case 'refus': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchQuery));
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesCity = cityFilter === "all" || p.city === cityFilter;
    return matchesSearch && matchesStatus && matchesCity;
  });

  const uniqueCities = Array.from(new Set(prospects.map(p => p.city).filter(Boolean)));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copié dans le presse-papier !");
  };

  const scriptFrWhatsApp = `Bonjour Docteur 👋\n\nJ'espère que vous allez bien. Je vous contacte car nous venons de lancer SyncAPOS, une nouvelle solution logicielle marocaine spécialement conçue pour les cabinets médicaux et centres de kinésithérapie. 🇲🇦\n\nContrairement aux logiciels classiques, nous avons réuni dans une seule interface ultra-facile :\n✅ Votre Caisse & Facturation tactile\n✅ Votre Agenda patient intelligent\n✅ La gestion de vos Packs de séances\n\n👉 Découvrez notre solution complète : http://localhost:5173/\n\nSeriez-vous disponible cette semaine pour que je vous offre une Démonstration Gratuite de 10 minutes en ligne ou dans votre cabinet ?`;
  const scriptArWhatsApp = `السلام عليكم دكتور 👋\n\nأتمنى أن تكونوا بخير. نتواصل معكم لتقديم SyncAPOS، برنامج مغربي جديد مصمم خصيصاً للعيادات الطبية ومراكز الترويض الطبي. 🇲🇦\n\nعلى عكس البرامج التقليدية، جمعنا لكم في واجهة واحدة سهلة الاستخدام:\n✅ نظام الأداء والفواتير (Caisse)\n✅ مفكرة مواعيد ذكية للمرضى (Agenda)\n✅ تتبع حصص العلاج والترويض (Packs)\n\n👉 اكتشفوا برنامجنا : http://localhost:5173/\n\nهل يمكننا ترتيب عرض توضيحي مجاني لمدة 10 دقائق هذا الأسبوع، سواء عبر الإنترنت أو في عيادتكم؟`;
  const scriptFrEmail = `Objet : Modernisez la gestion de votre centre avec SyncAPOS (Démo Gratuite)\n\nBonjour,\n\nEn tant que professionnel de santé, vous savez que la gestion administrative peut être chronophage. \n\nC'est pourquoi nous avons développé SyncAPOS, un outil marocain "tout-en-un".\n- Caisse Visuelle : Encaissement rapide.\n- Agenda Intégré : Prise de rendez-vous fluide.\n- Dossiers Patients : Suivi des "Packs de soins".\n\nAimeriez-vous voir comment cela fonctionne ?\nJe serais ravi de vous faire une courte présentation gratuite (en visio ou dans votre cabinet).\n\nDans l'attente de votre retour, je vous invite à consulter la brochure jointe.\nCordialement,`;
  const scriptArEmail = `الموضوع: تطوير إدارة مركزكم مع SyncAPOS (عرض تجريبي مجاني)\n\nالسلام عليكم،\n\nبصفتكم أخصائيين في مجال الصحة، تعلمون أن التسيير الإداري يأخذ الكثير من الوقت.\n\nلهذا السبب قمنا بتطوير SyncAPOS، وهو برنامج مغربي شامل يجمع بين:\n- صندوق الأداء (Caisse): استخلاص سريع وسهل.\n- مفكرة المواعيد (Agenda): تنظيم سلس للمرضى.\n- ملفات المرضى: تتبع دقيق لحصص العلاج.\n\nهل ترغبون في رؤية كيف يعمل البرنامج؟\nيسعدني أن أقدم لكم عرضاً توضيحياً مجانياً وقصيراً (عن بُعد أو في مركزكم).\n\nفي انتظار ردكم، أدعوكم للاطلاع على الكتيب المرفق.\nتقبلوا خالص تحياتي،`;

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement du CRM...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display text-primary flex items-center gap-3">
            <PhoneCall className="w-8 h-8" />
            CRM & Prospection Commerciale
          </h1>
          <p className="text-muted-foreground mt-1">
            {user.role === 'super_admin' 
              ? "Super-Admin : Visualisez tous les prospects et assignez-les à vos commerciaux." 
              : "Espace Commercial : Vos cibles prioritaires à contacter aujourd'hui."}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <MessageSquareText className="w-4 h-4" />
              Scripts & Modèles de messages
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-primary flex items-center gap-2">
                <MessageSquareText className="w-5 h-5" />
                Scripts de Prospection
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Tabs defaultValue="fr" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="ar">العربية</TabsTrigger>
                </TabsList>
                
                <TabsContent value="fr" className="space-y-6">
                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-green-600 flex items-center gap-2">
                        <PhoneCall className="w-4 h-4" /> Message WhatsApp
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptFrWhatsApp)}>
                        <Copy className="w-4 h-4 mr-2" /> Copier
                      </Button>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-sm text-green-900 font-medium whitespace-pre-wrap border border-green-100">
                      {scriptFrWhatsApp}
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-blue-600 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Email Professionnel
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptFrEmail)}>
                        <Copy className="w-4 h-4 mr-2" /> Copier
                      </Button>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900 whitespace-pre-wrap border border-blue-100">
                      {scriptFrEmail}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ar" className="space-y-6">
                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
                      <h3 className="font-semibold text-emerald-600 flex items-center gap-2">
                        <PhoneCall className="w-4 h-4" /> رسالة واتساب
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptArWhatsApp)}>
                        <Copy className="w-4 h-4 ml-2" /> نسخ
                      </Button>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg text-sm text-emerald-900 font-medium whitespace-pre-wrap border border-emerald-100 text-right" dir="rtl">
                      {scriptArWhatsApp}
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
                      <h3 className="font-semibold text-sky-600 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> إيميل احترافي
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptArEmail)}>
                        <Copy className="w-4 h-4 ml-2" /> نسخ
                      </Button>
                    </div>
                    <div className="bg-sky-50 p-4 rounded-lg text-sm text-sky-900 whitespace-pre-wrap border border-sky-100 text-right" dir="rtl">
                      {scriptArEmail}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Rechercher un prospect ou n° de téléphone..." 
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
              <MapPin className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {uniqueCities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="nouveau">Nouveau</SelectItem>
              <SelectItem value="contacté">Contacté</SelectItem>
              <SelectItem value="intéressé">Intéressé / RDV</SelectItem>
              <SelectItem value="client">Converti (Client)</SelectItem>
              <SelectItem value="refus">Refus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Prospect & Spécialité</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              {user.role === 'super_admin' && <TableHead>Assigné à</TableHead>}
              <TableHead className="text-right">Actions Rapides</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.map(p => (
              <TableRow key={p.id} className="group">
                <TableCell>
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Building2 className="w-3 h-3" /> {p.specialty} • <MapPin className="w-3 h-3 ml-1" /> {p.city || "Ville inconnue"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm text-slate-600">
                    <a href={`https://wa.me/${p.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                      <Phone className="w-3 h-3" /> {p.phone || "Non renseigné"}
                    </a>
                    {p.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" /> {p.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={(v) => handleStatusChange(p.id, v)}>
                    <SelectTrigger className={`w-[130px] h-8 text-xs font-semibold border-0 ${getStatusColor(p.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nouveau">Nouveau</SelectItem>
                      <SelectItem value="contacté">Contacté</SelectItem>
                      <SelectItem value="intéressé">Intéressé / RDV</SelectItem>
                      <SelectItem value="client">Converti (Client)</SelectItem>
                      <SelectItem value="refus">Refus</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                {user.role === 'super_admin' && (
                  <TableCell>
                    <Select value={p.assigned_to || 'none'} onValueChange={(v) => handleAssignChange(p.id, v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non assigné</SelectItem>
                        {agents.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className="h-8 gap-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100" asChild>
                    <a href={`https://wa.me/${p.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer">
                      <PhoneCall className="w-3 h-3" />
                      Appeler / WhatsApp
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredProspects.length === 0 && (
              <TableRow>
                <TableCell colSpan={user.role === 'super_admin' ? 5 : 4} className="text-center py-12 text-slate-500">
                  Aucun prospect trouvé avec ces filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
