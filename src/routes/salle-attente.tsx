import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAppointmentsAction, getProductsAction, getClientsAction, createAppointmentAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, UserCheck, Sparkles, Award, Plus, UserPlus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/salle-attente")({
  component: SalleAttentePage,
});

function SalleAttentePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Quick Walk-In Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [initialStatus, setInitialStatus] = useState<"waiting" | "completed">("waiting");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAppts = async () => {
    if (!user?.tenant_id) return;
    try {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const data = (await getAppointmentsAction({
        data: { date: today, tenantId: user.tenant_id },
      })) as any[];

      // Filter and sort chronologically by starts_at for priority queue
      const waiting = data
        .filter((a: any) => a.status === "waiting")
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

      setAppts(waiting);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAppts();
    const interval = setInterval(loadAppts, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [user?.tenant_id]);

  useEffect(() => {
    if (user?.tenant_id) {
      (async () => {
        try {
          const [prods, cls] = await Promise.all([
            getProductsAction({ data: { tenantId: user.tenant_id } }),
            getClientsAction({ data: { tenantId: user.tenant_id } })
          ]);
          setProducts((prods as any[]) || []);
          setClients((cls as any[]) || []);
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [user?.tenant_id]);

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    let finalClientName = clientName.trim();
    if (selectedClientId) {
      const foundClient = clients.find(c => c.id === selectedClientId);
      if (foundClient) {
        finalClientName = `${foundClient.first_name} ${foundClient.last_name || ""}`.trim();
      }
    }

    let finalServiceName = serviceName.trim();
    if (selectedProductId) {
      const foundProd = products.find(p => p.id === selectedProductId);
      if (foundProd) {
        finalServiceName = foundProd.name;
      }
    }

    if (!finalClientName || !finalServiceName) {
      toast.error("Veuillez saisir le nom du client et le nom de la prestation.");
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await createAppointmentAction({
        data: {
          client_id: selectedClientId || null,
          client_name: finalClientName,
          product_id: selectedProductId || null,
          service_name: finalServiceName,
          starts_at: nowStr,
          duration_min: 30,
          notes: "Client sans rendez-vous (Walk-in)",
          created_by: user?.id,
          status: initialStatus
        }
      });

      if (initialStatus === "waiting") {
        toast.success(`Client ${finalClientName} ajouté en Salle d'Attente (Statut: En attente)`);
      } else {
        toast.success(`Client ${finalClientName} comptabilisé directement comme Presté (Réalisé)`);
      }

      setClientName("");
      setServiceName("");
      setSelectedClientId("");
      setSelectedProductId("");
      setDialogOpen(false);
      await loadAppts();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur: " + (err?.message || "Impossible de créer le passage sans RDV"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isAuthenticated)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-display text-slate-500">
        Chargement...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-display selection:bg-orange-100 selection:text-orange-900">
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-8 py-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl border border-orange-200">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold font-display text-primary flex items-center gap-3">
              Salle d'Attente
              {appts.length > 0 && (
                <span className="bg-orange-500 text-white text-sm px-3 py-0.5 rounded-full font-bold shadow-sm">
                  {appts.length} {appts.length === 1 ? "personne" : "personnes"}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">Gestion des priorités et ordre de passage</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* BOUTON SANS RDV */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-6 rounded-2xl shadow-md text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                + Client Sans RDV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-orange-600" />
                  Passage Sans Rendez-Vous
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateWalkIn} className="space-y-4 py-2">
                {/* CHOIX DU CLIENT */}
                <div className="space-y-2">
                  <Label>Client (Existant ou Nouveau)</Label>
                  <Select
                    value={selectedClientId || "__manual"}
                    onValueChange={(val) => {
                      if (val === "__manual") {
                        setSelectedClientId("");
                      } else {
                        setSelectedClientId(val);
                        setClientName("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un client existant..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual">-- Saisie manuelle --</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedClientId && (
                    <Input
                      placeholder="Ou saisissez le nom du client..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                {/* CHOIX DU SERVICE */}
                <div className="space-y-2">
                  <Label>Service / Prestation</Label>
                  <Select
                    value={selectedProductId || "__manual"}
                    onValueChange={(val) => {
                      if (val === "__manual") {
                        setSelectedProductId("");
                      } else {
                        setSelectedProductId(val);
                        setServiceName("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir dans le catalogue..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual">-- Saisie manuelle --</SelectItem>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedProductId && (
                    <Input
                      placeholder="Ou nom du soin/prestation..."
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                {/* CHOIX DU STATUT INITIAL */}
                <div className="space-y-2 pt-2">
                  <Label className="font-bold text-slate-700">Statut initial du passage :</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInitialStatus("waiting")}
                      className={`p-3 rounded-xl border font-bold text-sm text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        initialStatus === "waiting"
                          ? "bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-300"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>🟧 En Attente</span>
                      <span className="text-[11px] font-normal opacity-90">(Ajouter en Salle d'Attente)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInitialStatus("completed")}
                      className={`p-3 rounded-xl border font-bold text-sm text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        initialStatus === "completed"
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>🟢 Presté (Réalisé)</span>
                      <span className="text-[11px] font-normal opacity-90">(Déjà effectué / Direct)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-primary text-white font-bold">
                    {submitting ? "Enregistrement..." : "Enregistrer le passage"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl shadow-inner">
            <Clock className="w-7 h-7 text-primary animate-pulse" />
            <span className="text-3xl font-bold tracking-tight text-slate-700">
              {format(currentTime, "HH:mm:ss", { locale: fr })}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 flex flex-col">
        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-20">
            <div className="w-24 h-24 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-6">
              <Sparkles className="w-12 h-12 text-slate-300" />
            </div>
            <h2 className="text-3xl font-bold text-slate-700 mb-2">Aucun patient en attente pour le moment</h2>
            <p className="text-slate-500 text-lg mb-4">La liste d'attente est actuellement vide</p>
            <Button onClick={() => setDialogOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2 rounded-xl">
              <UserPlus className="w-5 h-5" />
              Ajouter un Client Sans RDV
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 auto-rows-max">
            {appts.map((appt, index) => {
              const priorityNumber = index + 1;
              const isNext = index === 0;

              return (
                <div
                  key={appt.id}
                  className={`bg-white rounded-2xl shadow-xl p-8 border-l-8 transition-all duration-500 flex flex-col justify-between min-h-[240px] animate-in fade-in zoom-in ${
                    isNext
                      ? "border-orange-500 ring-2 ring-orange-400/40 bg-gradient-to-br from-amber-50/60 to-white"
                      : "border-slate-300"
                  }`}
                >
                  {/* HEADER CARD: BADGE PRIORITÉ */}
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-lg shadow-sm border ${
                        isNext
                          ? "bg-orange-500 text-white border-orange-600 animate-pulse"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <Award className="w-5 h-5" />
                      <span>N° {priorityNumber}</span>
                    </div>

                    {isNext && (
                      <span className="bg-orange-100 text-orange-800 border border-orange-200 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                        PROCHAIN CLIENT
                      </span>
                    )}
                  </div>

                  {/* CLIENT NAME */}
                  <div className="my-2">
                    <h2
                      className="text-4xl font-bold text-slate-800 mb-2 truncate"
                      title={appt.client_name}
                    >
                      {appt.client_name}
                    </h2>
                    {appt.service_name && (
                      <p className="text-lg text-slate-500 truncate" title={appt.service_name}>
                        {appt.service_name}
                      </p>
                    )}
                  </div>

                  {/* FOOTER DETAILS */}
                  <div className="space-y-1 mt-auto pt-4 border-t border-slate-100">
                    <p className="text-xl text-slate-500">
                      Heure prévue :{" "}
                      <span className="font-semibold text-slate-700">
                        {format(new Date(appt.starts_at), "HH:mm")}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white px-8 py-4 border-t border-slate-200 text-center text-slate-500 text-sm flex justify-between items-center">
        <span>{user?.tenant_name || "Système de Gestion de Rendez-vous"}</span>
        <span className="text-xs text-slate-400">Ordre de priorité 1 à N</span>
      </footer>
    </div>
  );
}
