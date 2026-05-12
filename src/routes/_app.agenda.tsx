import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getAppointmentsAction, getAppointmentsRangeAction, getProductsAction, getClientsAction, updateAppointmentStatusAction, createAppointmentAction, syncFromGoogleAction, updateAppointmentAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, CalendarDays, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { addDays, addWeeks, addMonths, format, isSameDay, parseISO, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaPage,
});

type ViewMode = "day" | "week" | "month";

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
  google_event_id: string | null;
}

interface Product { id: string; name: string; bookable: boolean; duration_min: number | null; }
interface Client { id: string; first_name: string; last_name: string | null; }

const statusColor: Record<Appt["status"], string> = {
  scheduled: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-sage/30 text-sage-foreground border-sage/50",
  cancelled: "bg-muted text-muted-foreground border-muted",
  no_show: "bg-destructive/15 text-destructive border-destructive/30",
};
const labels: Record<Appt["status"], string> = {
  scheduled: "Prévu", completed: "Réalisé", cancelled: "Annulé", no_show: "Absent",
};

function AgendaPage() {
  const { user } = useAuth();
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [view, setView] = useState<ViewMode>("week");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<Appt | null>(null);
  const [syncing, setSyncing] = useState(false);

  const syncFromGoogle = async () => {
    setSyncing(true);
    try {
      const start = view === "month" ? startOfMonth(day) : startOfWeek(day, { weekStartsOn: 1 });
      const end = view === "month" ? endOfMonth(day) : endOfWeek(day, { weekStartsOn: 1 });
      const from = format(view === "day" ? addDays(day, -7) : start, "yyyy-MM-dd");
      const to = format(view === "day" ? addDays(day, 7) : end, "yyyy-MM-dd");
      const result = await syncFromGoogleAction({ data: { from, to } }) as any;
      toast.success(`Synchronisé : ${result.imported} nouveau(x) RDV importé(s) sur ${result.total} événements Google`);
      load();
    } catch (err: any) {
      toast.error("Erreur synchro: " + (err?.message || "Échec"));
    }
    setSyncing(false);
  };

  const load = async () => {
    if (view === "day") {
      const dayStr = format(day, "yyyy-MM-dd");
      const data = await getAppointmentsAction({ data: dayStr });
      setAppts(data as unknown as Appt[]);
    } else {
      const start = view === "week" ? startOfWeek(day, { weekStartsOn: 1 }) : startOfMonth(day);
      const end = view === "week" ? endOfWeek(day, { weekStartsOn: 1 }) : endOfMonth(day);
      const data = await getAppointmentsRangeAction({ data: { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") } });
      setAppts(data as unknown as Appt[]);
    }
  };

  useEffect(() => {
    (async () => {
      const pr = await getProductsAction();
      setProducts(pr as unknown as Product[]);
      const cl = await getClientsAction();
      setClients(cl as unknown as Client[]);
    })();
  }, []);
  useEffect(() => { load(); }, [day, view]);

  const setStatus = async (id: string, status: Appt["status"]) => {
    await updateAppointmentStatusAction({ data: { id, status, userId: user?.id } });
    load();
    toast.success("Statut mis à jour");
  };

  const navigate = (dir: number) => {
    if (view === "day") setDay(d => addDays(d, dir));
    else if (view === "week") setDay(d => addWeeks(d, dir));
    else setDay(d => addMonths(d, dir));
  };

  const headerLabel = () => {
    if (view === "day") return format(day, "EEEE d MMMM yyyy", { locale: fr });
    if (view === "week") {
      const s = startOfWeek(day, { weekStartsOn: 1 });
      const e = endOfWeek(day, { weekStartsOn: 1 });
      return `${format(s, "d MMM", { locale: fr })} — ${format(e, "d MMM yyyy", { locale: fr })}`;
    }
    return format(day, "MMMM yyyy", { locale: fr });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-primary flex-1">Agenda</h1>

        {/* View Switcher */}
        <div className="flex items-center gap-1 pos-card p-1">
          <Button size="sm" variant={view === "day" ? "default" : "ghost"} onClick={() => setView("day")} title="Jour">
            <List className="w-4 h-4 mr-1" />Jour
          </Button>
          <Button size="sm" variant={view === "week" ? "default" : "ghost"} onClick={() => setView("week")} title="Semaine">
            <CalendarDays className="w-4 h-4 mr-1" />Semaine
          </Button>
          <Button size="sm" variant={view === "month" ? "default" : "ghost"} onClick={() => setView("month")} title="Mois">
            <LayoutGrid className="w-4 h-4 mr-1" />Mois
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1 pos-card p-1">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="px-3 text-sm font-medium min-w-[200px] text-center capitalize">{headerLabel()}</span>
          <Button size="icon" variant="ghost" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setDay(startOfDay(new Date()))}>Aujourd'hui</Button>
        </div>

        <Button variant="outline" onClick={syncFromGoogle} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchro..." : "Sync Google"}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau RDV</Button>
          </DialogTrigger>
          <ApptDialog products={products} clients={clients} defaultDay={day} userId={user?.id} onSaved={() => { setOpen(false); load(); }} />
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editAppt} onOpenChange={(v) => { if (!v) setEditAppt(null); }}>
          {editAppt && (
            <EditApptDialog appt={editAppt} products={products} userId={user?.id} onSaved={async () => { await load(); setEditAppt(null); }} />
          )}
        </Dialog>
      </div>

      {/* Views */}
      {view === "day" && <DayView appts={appts} onStatus={setStatus} onEdit={setEditAppt} />}
      {view === "week" && <WeekView appts={appts} day={day} onStatus={setStatus} onDayClick={(d) => { setDay(d); setView("day"); }} onEdit={setEditAppt} />}
      {view === "month" && <MonthView appts={appts} day={day} onDayClick={(d) => { setDay(d); setView("day"); }} />}
    </div>
  );
}

/* ============================== DAY VIEW ============================== */
function DayView({ appts, onStatus, onEdit }: { appts: Appt[]; onStatus: (id: string, s: Appt["status"]) => void; onEdit: (a: Appt) => void }) {
  if (appts.length === 0) {
    return (
      <div className="pos-card p-12 text-center text-muted-foreground">
        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
        Aucun rendez-vous ce jour.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {appts.map((a) => <ApptRow key={a.id} appt={a} onStatus={onStatus} onEdit={onEdit} />)}
    </div>
  );
}

/* ============================== WEEK VIEW ============================== */
function WeekView({ appts, day, onStatus, onDayClick, onEdit }: { appts: Appt[]; day: Date; onStatus: (id: string, s: Appt["status"]) => void; onDayClick: (d: Date) => void; onEdit: (a: Appt) => void }) {
  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(day, { weekStartsOn: 1 }) });

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    days.forEach(d => { map[format(d, "yyyy-MM-dd")] = []; });
    appts.forEach(a => {
      const key = format(parseISO(a.starts_at), "yyyy-MM-dd");
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [appts, days]);

  return (
    <div className="grid grid-cols-7 gap-1" style={{ minHeight: "60vh" }}>
      {days.map(d => {
        const key = format(d, "yyyy-MM-dd");
        const dayAppts = apptsByDay[key] || [];
        const today = isToday(d);
        return (
          <div key={key} className={`pos-card p-2 flex flex-col ${today ? "ring-2 ring-primary" : ""}`}>
            <button onClick={() => onDayClick(d)} className="text-center mb-2 hover:opacity-70 transition-opacity">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(d, "EEE", { locale: fr })}
              </p>
              <p className={`text-lg font-display ${today ? "bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
                {format(d, "d")}
              </p>
            </button>
            <div className="flex-1 space-y-1 overflow-y-auto" style={{ maxHeight: "50vh" }}>
              {dayAppts.map(a => (
                <WeekApptCard key={a.id} appt={a} onEdit={onEdit} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekApptCard({ appt, onEdit }: { appt: Appt; onEdit: (a: Appt) => void }) {
  const start = parseISO(appt.starts_at);
  return (
    <div onClick={() => onEdit(appt)} className={`rounded-md p-1.5 text-[11px] border cursor-pointer transition-all hover:shadow-md ${statusColor[appt.status]}`}>
      <p className="font-semibold truncate">{format(start, "HH:mm")} {appt.client_name}</p>
      <p className="truncate opacity-80">{appt.service_name}</p>
    </div>
  );
}

/* ============================== MONTH VIEW ============================== */
function MonthView({ appts, day, onDayClick }: { appts: Appt[]; day: Date; onDayClick: (d: Date) => void }) {
  const monthStart = startOfMonth(day);
  const monthEnd = endOfMonth(day);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    appts.forEach(a => {
      const key = format(parseISO(a.starts_at), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appts]);

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-t-lg overflow-hidden">
        {dayNames.map(n => (
          <div key={n} className="bg-muted p-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-b-lg overflow-hidden">
        {allDays.map(d => {
          const key = format(d, "yyyy-MM-dd");
          const dayAppts = apptsByDay[key] || [];
          const today = isToday(d);
          const inMonth = isSameMonth(d, day);
          return (
            <button key={key} onClick={() => onDayClick(d)}
              className={`bg-card p-2 min-h-[90px] text-left transition-colors hover:bg-primary/5 ${!inMonth ? "opacity-40" : ""}`}>
              <p className={`text-sm mb-1 ${today ? "bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                {format(d, "d")}
              </p>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map(a => (
                  <div key={a.id} className={`text-[10px] px-1 py-0.5 rounded truncate border ${statusColor[a.status]}`}>
                    {format(parseISO(a.starts_at), "HH:mm")} {a.client_name}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <p className="text-[10px] text-primary font-medium">+{dayAppts.length - 3} de plus</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== APPOINTMENT ROW (Day View) ============================== */
function ApptRow({ appt, onStatus, onEdit }: { appt: Appt; onStatus: (id: string, s: Appt["status"]) => void; onEdit: (a: Appt) => void }) {
  const start = parseISO(appt.starts_at);
  return (
    <div className="pos-card p-4 flex items-center gap-4">
      <div className="flex-1 flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onEdit(appt)}>
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
          {appt.google_event_id && (
            <p className="text-[10px] text-sage flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" />
              Synchronisé avec Google Calendar
            </p>
          )}
        </div>
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

/* ============================== NEW APPOINTMENT DIALOG ============================== */
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
    try {
      await createAppointmentAction({
        data: {
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
    } catch (err: any) {
      console.error("Erreur création RDV:", err);
      toast.error("Erreur: " + (err?.message || "Impossible de créer le RDV"));
    }
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

/* ============================== EDIT APPOINTMENT DIALOG ============================== */
function EditApptDialog({ appt, products, userId, onSaved }: {
  appt: Appt; products: Product[]; userId?: string; onSaved: () => void;
}) {
  const [clientName, setClientName] = useState(appt.client_name);
  const [serviceName, setServiceName] = useState(appt.service_name);
  const startDate = parseISO(appt.starts_at);
  const [date, setDate] = useState(format(startDate, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(startDate, "HH:mm"));
  const [duration, setDuration] = useState(appt.duration_min);
  const [notes, setNotes] = useState(appt.notes || "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientName) { toast.error("Nom du client requis"); return; }
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    try {
      await updateAppointmentAction({
        data: {
          id: appt.id,
          client_name: clientName,
          service_name: serviceName,
          starts_at: startsAt,
          duration_min: duration,
          notes: notes || null,
        }
      });
      toast.success("Rendez-vous modifié");
      onSaved();
    } catch (err: any) {
      toast.error("Erreur: " + (err?.message || "Impossible de modifier"));
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-primary">Modifier le rendez-vous</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Client</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></div>
        <div>
          <Label>Prestation</Label>
          <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Heure</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          <div><Label>Durée (min)</Label><Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
