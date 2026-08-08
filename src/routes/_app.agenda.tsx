import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getAppointmentsAction, getAppointmentsRangeAction, getProductsAction, getClientsAction, updateAppointmentStatusAction, createAppointmentAction, syncFromGoogleAction, updateAppointmentAction, deleteAppointmentAction, getProspectsAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, CalendarDays, RefreshCw, Trash2 } from "lucide-react";
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
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "waiting";
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
  waiting: "bg-orange-100 text-orange-800 border-orange-200",
};
const labels: Record<Appt["status"], string> = {
  scheduled: "Prévu", completed: "Presté (Réalisé)", cancelled: "Annulé", no_show: "Absent", waiting: "En attente",
};

function AgendaPage() {
  const { user } = useAuth();
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [view, setView] = useState<ViewMode>("week");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
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
      const result = await syncFromGoogleAction({ data: { from, to, userId: user?.id } }) as any;
      toast.success(`Synchronisé : ${result.imported} nouveau(x) RDV importé(s) sur ${result.total} événements Google`);
      load();
    } catch (err: any) {
      toast.error("Erreur synchro: " + (err?.message || "Échec"));
    }
    setSyncing(false);
  };

  const load = async () => {
    if (!user?.tenant_id) return;
    let data: any[] = [];
    try {
      if (view === "day") {
        const dayStr = format(day, "yyyy-MM-dd");
        data = (await getAppointmentsAction({ data: { date: dayStr, tenantId: user.tenant_id } })) as any[];
      } else {
        const start = view === "week" ? startOfWeek(day, { weekStartsOn: 1 }) : startOfMonth(day);
        const end = view === "week" ? endOfWeek(day, { weekStartsOn: 1 }) : endOfMonth(day);
        data = (await getAppointmentsRangeAction({
          data: { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), tenantId: user.tenant_id },
        })) as any[];
      }
      setAppts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erreur chargement rendez-vous agenda:", e);
      setAppts([]);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    (async () => {
      try {
        const [pr, cl] = await Promise.all([
          getProductsAction({ data: { tenantId: user.tenant_id } }),
          getClientsAction({ data: { tenantId: user.tenant_id } }),
        ]);
        setProducts((pr as unknown as Product[]) || []);
        setClients((cl as unknown as Client[]) || []);

        if (user.tenant_id === "system-tenant" && user?.id) {
          const prs = await getProspectsAction({ data: { userId: user.id } });
          setProspects((prs as any[]) || []);
        }
      } catch (e) {
        console.error("Erreur chargement produits/clients agenda:", e);
      }
    })();
  }, [user?.tenant_id, user?.id]);

  useEffect(() => {
    load();
  }, [day, view, user?.tenant_id]);

  const setStatus = async (id: string, s: Appt["status"]) => {
    try {
      await updateAppointmentStatusAction({ data: { id, status: s, userId: user?.id || "" } });
      toast.success("Statut mis à jour");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteAppt = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce rendez-vous ?")) return;
    try {
      await deleteAppointmentAction({ data: { id, userId: user?.id || "" } });
      toast.success("Rendez-vous supprimé");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
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

        <Button variant="outline" asChild title="Ouvrir l'écran de la salle d'attente">
          <a href="/salle-attente" target="_blank" rel="noopener noreferrer">
            <LayoutGrid className="w-4 h-4 mr-2" />Salle d'Attente
          </a>
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau RDV</Button>
          </DialogTrigger>
          <ApptDialog products={products} clients={clients} prospects={prospects} defaultDay={day} userId={user?.id} tenantId={user?.tenant_id} onSaved={() => { setOpen(false); load(); }} />
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editAppt} onOpenChange={(v) => { if (!v) setEditAppt(null); }}>
          {editAppt && (
            <EditApptDialog 
              appt={editAppt} 
              products={products} 
              userId={user?.id} 
              tenantId={user?.tenant_id}
              onSaved={async () => { await load(); setEditAppt(null); }} 
              onDelete={async () => { await deleteAppt(editAppt.id); setEditAppt(null); }}
            />
          )}
        </Dialog>
      </div>

      {/* Views */}
      {view === "day" && <DayView appts={appts} onStatus={setStatus} onEdit={setEditAppt} onDelete={deleteAppt} />}
      {view === "week" && <WeekView appts={appts} day={day} onStatus={setStatus} onDayClick={(d) => { setDay(d); setView("day"); }} onEdit={setEditAppt} />}
      {view === "month" && <MonthView appts={appts} day={day} onDayClick={(d) => { setDay(d); setView("day"); }} />}
    </div>
  );
}

/* ============================== DAY VIEW ============================== */
function DayView({ appts, onStatus, onEdit, onDelete }: { appts: Appt[]; onStatus: (id: string, s: Appt["status"]) => void; onEdit: (a: Appt) => void; onDelete: (id: string) => void }) {
  const grouped = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    appts.forEach(a => {
      if (!map[a.starts_at]) map[a.starts_at] = [];
      map[a.starts_at].push(a);
    });
    return Object.keys(map).sort().map(k => map[k]);
  }, [appts]);

  if (appts.length === 0) {
    return (
      <div className="pos-card p-12 text-center text-muted-foreground">
        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
        Aucun rendez-vous ce jour.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {grouped.map((group, idx) => (
        <div key={idx} className="flex flex-col md:flex-row gap-2">
          {group.map((a) => (
            <div key={a.id} className="flex-1 min-w-0">
              <ApptRow appt={a} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function safeParseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  try {
    const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return new Date();
    return d;
  } catch (e) {
    return new Date();
  }
}

/* ============================== WEEK VIEW ============================== */
function WeekView({ appts, day, onStatus, onDayClick, onEdit }: { appts: Appt[]; day: Date; onStatus: (id: string, s: Appt["status"]) => void; onDayClick: (d: Date) => void; onEdit: (a: Appt) => void }) {
  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(day, { weekStartsOn: 1 }) });

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    days.forEach(d => { map[format(d, "yyyy-MM-dd")] = []; });
    appts.forEach(a => {
      const key = format(safeParseDate(a.starts_at), "yyyy-MM-dd");
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
              {(() => {
                const map: Record<string, Appt[]> = {};
                dayAppts.forEach(a => {
                  if (!map[a.starts_at]) map[a.starts_at] = [];
                  map[a.starts_at].push(a);
                });
                const grouped = Object.keys(map).sort().map(k => map[k]);
                return grouped.map((group, idx) => (
                  <div key={idx} className="flex flex-row gap-1">
                    {group.map(a => (
                      <div key={a.id} className="flex-1 min-w-0">
                        <WeekApptCard appt={a} onEdit={onEdit} />
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekApptCard({ appt, onEdit }: { appt: Appt; onEdit: (a: Appt) => void }) {
  const start = safeParseDate(appt.starts_at);
  const statusKey: Appt["status"] = (appt.status && statusColor[appt.status]) ? appt.status : "scheduled";
  return (
    <div 
      onClick={() => onEdit(appt)} 
      title={`${format(start, "HH:mm")} - ${appt.client_name}\n${appt.service_name}`}
      className={`rounded-md p-1 text-[10px] leading-tight border cursor-pointer transition-all hover:shadow-md ${statusColor[statusKey]}`}
    >
      <p className="font-semibold break-words">{format(start, "HH:mm")} <br className="hidden sm:block" />{appt.client_name}</p>
      <p className="break-words opacity-80 mt-0.5">{appt.service_name}</p>
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
      const key = format(safeParseDate(a.starts_at), "yyyy-MM-dd");
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
                {dayAppts.slice(0, 3).map(a => {
                  const sKey: Appt["status"] = (a.status && statusColor[a.status]) ? a.status : "scheduled";
                  return (
                    <div key={a.id} className={`text-[10px] px-1 py-0.5 rounded truncate border ${statusColor[sKey]}`}>
                      {format(safeParseDate(a.starts_at), "HH:mm")} {a.client_name}
                    </div>
                  );
                })}
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
function ApptRow({ appt, onStatus, onEdit, onDelete }: { appt: Appt; onStatus: (id: string, s: Appt["status"]) => void; onEdit: (a: Appt) => void; onDelete: (id: string) => void }) {
  const start = safeParseDate(appt.starts_at);
  return (
    <div className="pos-card p-4 flex flex-wrap items-center gap-4 h-full">
      <div className="flex-1 min-w-[200px] flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onEdit(appt)}>
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
      {(() => {
        const statusKey: Appt["status"] = (appt.status && statusColor[appt.status]) ? appt.status : "scheduled";
        return (
          <>
            <Badge className={statusColor[statusKey]}>{labels[statusKey]}</Badge>
            <Select value={statusKey} onValueChange={(v) => onStatus(appt.id, v as Appt["status"])}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Prévu</SelectItem>
                <SelectItem value="waiting">En attente</SelectItem>
                <SelectItem value="completed">Presté (Réalisé)</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
                <SelectItem value="no_show">Absent</SelectItem>
              </SelectContent>
            </Select>
          </>
        );
      })()}
      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDelete(appt.id); }}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ============================== NEW APPOINTMENT DIALOG ============================== */
function ApptDialog({ products, clients, prospects, defaultDay, userId, tenantId, onSaved }: {
  products: Product[]; clients: Client[]; prospects: any[]; defaultDay: Date; userId?: string; tenantId?: string; onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [manualName, setManualName] = useState("");
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(format(defaultDay, "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState<"scheduled" | "waiting" | "completed">("scheduled");
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isSystem = tenantId === 'system-tenant';

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p?.duration_min) setDuration(p.duration_min);
  }, [productId, products]);

  const filteredProspects = useMemo(() => {
    if (!searchQuery) return prospects;
    const q = searchQuery.toLowerCase();
    return prospects.filter((p) => 
      (p.name || "").toLowerCase().includes(q) ||
      (p.city || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  }, [searchQuery, prospects]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    const product = products.find((p) => p.id === productId);
    const client = clients.find((c) => c.id === clientId);
    const prospect = prospects.find((p) => p.id === clientId);
    
    let clientName = manualName;
    if (client) {
      clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
    } else if (prospect) {
      clientName = prospect.name;
    }

    if (!clientName || !product) {
      toast.error(isSystem ? "Centre et démonstration requis" : "Client et prestation requis");
      return;
    }
    const startsAt = `${date}T${time}:00`;
    setSubmitting(true);
    try {
      await createAppointmentAction({
        data: {
          client_id: client ? clientId : null,
          client_name: clientName,
          product_id: product.id,
          service_name: product.name,
          starts_at: startsAt,
          duration_min: duration,
          notes: notes || null,
          created_by: userId ?? null,
          status: status,
        }
      });
      toast.success(isSystem ? "Rendez-vous de démo créé" : "Rendez-vous créé");
      onSaved();
    } catch (err: any) {
      console.error("Erreur création RDV:", err);
      toast.error("Erreur: " + (err?.message || "Impossible de créer le RDV"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-primary">
          {isSystem ? "Planifier une démo / RDV" : "Nouveau rendez-vous"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>{isSystem ? "Rechercher ou saisir le Centre médical" : "Client existant"}</Label>
          {isSystem ? (
            <div className="relative">
              <Input
                placeholder="Tapez le nom, la ville ou le téléphone du cabinet..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setManualName(val);
                  if (!val) {
                    setClientId("");
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                required
              />
              {showSuggestions && (
                <div className="absolute z-[100] w-full mt-1 bg-white text-popover-foreground rounded-md border shadow-lg max-h-[220px] overflow-y-auto divide-y divide-gray-100">
                  {filteredProspects.length === 0 ? (
                    <div className="px-3 py-2.5 text-sm text-muted-foreground italic">
                      Aucun centre trouvé. Saisie manuelle activée.
                    </div>
                  ) : (
                    filteredProspects.map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-2 text-sm hover:bg-primary/10 cursor-pointer transition-colors text-left flex flex-col"
                        onMouseDown={() => {
                          setClientId(p.id);
                          setManualName(p.name);
                          setSearchQuery(p.name);
                          setShowSuggestions(false);
                        }}
                      >
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                          {p.city && <span>📍 {p.city}</span>}
                          {p.phone && <span>📞 {p.phone}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <Select value={clientId || "__none"} onValueChange={(v) => setClientId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Saisir manuellement</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!isSystem && !clientId && (
          <div>
            <Label>Nom du client</Label>
            <Input value={manualName} onChange={(e) => setManualName(e.target.value)} required />
          </div>
        )}
        <div>
          <Label>{isSystem ? "Démonstration" : "Prestation"}</Label>
          <Select value={productId || "__none"} onValueChange={(v) => setProductId(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__none">Choisir une prestation...</SelectItem>
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
        <div>
          <Label>Statut Initial</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">🔵 Prévu (Agenda)</SelectItem>
              <SelectItem value="waiting">🟧 En attente (Salle d'Attente)</SelectItem>
              <SelectItem value="completed">🟢 Presté (Réalisé)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Création..." : "Créer le RDV"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ============================== EDIT APPOINTMENT DIALOG ============================== */
function EditApptDialog({ appt, products, userId, tenantId, onSaved, onDelete }: {
  appt: Appt; products: Product[]; userId?: string; tenantId?: string; onSaved: () => void; onDelete: () => void;
}) {
  const [clientName, setClientName] = useState(appt.client_name);
  const [serviceName, setServiceName] = useState(appt.service_name);
  const startDate = safeParseDate(appt.starts_at);
  const [date, setDate] = useState(format(startDate, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(startDate, "HH:mm"));
  const [duration, setDuration] = useState(appt.duration_min);
  const [notes, setNotes] = useState(appt.notes || "");

  const isSystem = tenantId === 'system-tenant';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientName) { toast.error(isSystem ? "Nom du centre requis" : "Nom du client requis"); return; }
    const startsAt = `${date}T${time}:00`;
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
        <DialogTitle className="font-display text-2xl text-primary">
          {isSystem ? "Modifier la démo / RDV" : "Modifier le rendez-vous"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>{isSystem ? "Nom du centre / Prospect" : "Nom du client"}</Label>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        </div>
        <div>
          <Label>{isSystem ? "Démonstration" : "Prestation"}</Label>
          <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Heure</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          <div><Label>Durée (min)</Label><Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button type="button" variant="destructive" onClick={onDelete} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Supprimer
          </Button>
          <Button type="submit">Enregistrer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
