import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getAppointmentsAction, getProductsAction, getClientsAction, updateAppointmentStatusAction, createAppointmentAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaPage,
});

interface Appt {
  id: string;
  client_name: string;
  service_name: string;
  starts_at: string;
  duration_min: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  client_id: string | null;
  product_id: string | null;
}

interface Product { id: string; name: string; bookable: boolean; duration_min: number | null; }
interface Client { id: string; first_name: string; last_name: string | null; }

function AgendaPage() {
  const { user } = useAuth();
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [appts, setAppts] = useState<Appt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const dayStr = format(day, "yyyy-MM-dd");
    const data = await getAppointmentsAction({ data: dayStr });
    setAppts(data as unknown as Appt[]);
  };

  useEffect(() => {
    (async () => {
      const pr = await getProductsAction();
      setProducts(pr as unknown as Product[]);
      
      const cl = await getClientsAction();
      setClients(cl as unknown as Client[]);
    })();
  }, []);
  useEffect(() => { load(); }, [day]);

  const setStatus = async (id: string, status: Appt["status"]) => {
    await updateAppointmentStatusAction({ data: { id, status } });
    load();
    toast.success("Statut mis à jour");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-primary flex-1">Agenda</h1>
        <div className="flex items-center gap-1 pos-card p-1">
          <Button size="icon" variant="ghost" onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="px-3 text-sm font-medium min-w-[180px] text-center">
            {format(day, "EEEE d MMMM yyyy", { locale: fr })}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setDay(startOfDay(new Date()))}>Aujourd'hui</Button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau RDV</Button>
          </DialogTrigger>
          <ApptDialog
            products={products}
            clients={clients}
            defaultDay={day}
            userId={user?.id}
            onSaved={() => { setOpen(false); load(); }}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr] gap-2">
        <div className="hidden lg:block" />
        <div className="space-y-2">
          {appts.length === 0 ? (
            <div className="pos-card p-12 text-center text-muted-foreground">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Aucun rendez-vous ce jour.
            </div>
          ) : (
            appts.map((a) => (
              <ApptRow key={a.id} appt={a} onStatus={setStatus} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ApptRow({ appt, onStatus }: { appt: Appt; onStatus: (id: string, s: Appt["status"]) => void }) {
  const start = parseISO(appt.starts_at);
  const statusColor: Record<Appt["status"], string> = {
    scheduled: "bg-primary-soft text-primary",
    completed: "bg-sage text-sage-foreground",
    cancelled: "bg-muted text-muted-foreground",
    no_show: "bg-destructive/15 text-destructive",
  };
  const labels: Record<Appt["status"], string> = {
    scheduled: "Prévu", completed: "Réalisé", cancelled: "Annulé", no_show: "Absent",
  };
  return (
    <div className="pos-card p-4 flex items-center gap-4">
      <div className="text-center min-w-[64px]">
        <p className="font-display text-2xl text-primary leading-none">{format(start, "HH:mm")}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />{appt.duration_min}min
        </p>
      </div>
      <div className="flex-1">
        <p className="font-medium">{appt.client_name}</p>
        <p className="text-sm text-muted-foreground">{appt.service_name}</p>
        {appt.notes && <p className="text-xs text-muted-foreground mt-1 italic">{appt.notes}</p>}
      </div>
      <Badge className={statusColor[appt.status]}>{labels[appt.status]}</Badge>
      <Select value={appt.status} onValueChange={(v) => onStatus(appt.id, v as Appt["status"])}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="scheduled">Prévu</SelectItem>
          <SelectItem value="completed">Réalisé</SelectItem>
          <SelectItem value="cancelled">Annulé</SelectItem>
          <SelectItem value="no_show">Absent</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ApptDialog({ products, clients, defaultDay, userId, onSaved }: {
  products: Product[]; clients: Client[]; defaultDay: Date; userId?: string; onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [manualName, setManualName] = useState("");
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(format(defaultDay, "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p?.duration_min) setDuration(p.duration_min);
  }, [productId, products]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === productId);
    const client = clients.find((c) => c.id === clientId);
    const clientName = client ? `${client.first_name} ${client.last_name ?? ""}`.trim() : manualName;
    if (!clientName || !product) {
      toast.error("Client et prestation requis");
      return;
    }
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    await createAppointmentAction({
      data: {
        id: crypto.randomUUID(),
        client_id: clientId || null,
        client_name: clientName,
        product_id: product.id,
        service_name: product.name,
        starts_at: startsAt,
        duration_min: duration,
        notes: notes || null,
        created_by: userId ?? null,
      }
    });
    
    toast.success("Rendez-vous créé"); 
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-primary">Nouveau rendez-vous</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Client existant</Label>
          <Select value={clientId} onValueChange={(v) => setClientId(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Saisir manuellement</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!clientId && (
          <div><Label>Nom du client</Label><Input value={manualName} onChange={(e) => setManualName(e.target.value)} required /></div>
        )}
        <div>
          <Label>Prestation</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Heure</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          <div><Label>Durée (min)</Label><Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit">Créer le RDV</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
