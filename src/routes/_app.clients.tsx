import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { getClientsAction, createClientAction, updateClientAction, deleteClientAction, getClientPacksAction, consumePackSessionAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

interface Client {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  is_member: boolean;
  children_count: number;
  notes: string | null;
}

interface Pack {
  id: string;
  product_id: string;
  sessions_total: number;
  sessions_remaining: number;
  purchased_at: string;
  products: { name: string } | null;
}

function ClientsPage() {
  const { user, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const load = async () => {
    const data = await getClientsAction();
    setClients((data ?? []) as Client[]);
  };
  useEffect(() => { load(); }, []);

  const openClient = async (c: Client) => {
    setSelectedClient(c);
    const data = await getClientPacksAction({ data: c.id });
    setPacks((data ?? []) as any);
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return `${c.first_name} ${c.last_name ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  const consumeSession = async (pack: Pack) => {
    if (pack.sessions_remaining <= 0) return;
    await consumePackSessionAction({ data: pack.id });
    if (selectedClient) openClient(selectedClient);
    toast.success("Séance décomptée");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce client ?")) return;
    try {
      await deleteClientAction({ data: { id, adminId: user?.id } });
      toast.success("Client supprimé");
      setSelectedClient(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-primary flex-1">Clients</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau client</Button>
          </DialogTrigger>
          <ClientDialog client={editing} onSaved={() => { setOpen(false); setEditing(null); load(); }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => openClient(c)}
            className="pos-card p-4 text-left hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1">
                <p className="font-medium">
                  {c.first_name} {c.last_name ?? ""}
                  {c.is_member && <Star className="inline w-3.5 h-3.5 ml-1.5 text-primary fill-current" />}
                </p>
                {c.children_count > 0 && (
                  <p className="text-xs text-muted-foreground">{c.children_count} enfant(s)</p>
                )}
              </div>
              {c.is_member && <Badge className="bg-primary-soft text-primary">Adhérent</Badge>}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
              {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</div>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">Aucun client</p>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(v) => !v && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-primary">
                  {selectedClient.first_name} {selectedClient.last_name ?? ""}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Téléphone</p><p>{selectedClient.phone ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Email</p><p>{selectedClient.email ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Adhérent</p><p>{selectedClient.is_member ? "Oui" : "Non"}</p></div>
                  <div><p className="text-muted-foreground">Enfants</p><p>{selectedClient.children_count}</p></div>
                </div>
                {selectedClient.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="bg-muted/40 p-3 rounded-md whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                )}
                <div>
                  <h3 className="font-display text-lg text-primary mb-2">Packs séances</h3>
                  {packs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun pack en cours.</p>
                  ) : (
                    <div className="space-y-2">
                      {packs.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{p.products?.name ?? "Pack"}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.sessions_remaining}/{p.sessions_total} séances restantes
                            </p>
                          </div>
                          <Button size="sm" variant="outline" disabled={p.sessions_remaining <= 0} onClick={() => consumeSession(p)}>
                            Consommer
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex justify-between items-center w-full">
                {isAdmin && (
                  <Button variant="ghost" className="text-destructive gap-2" onClick={() => handleDelete(selectedClient.id)}>
                    <Trash2 className="w-4 h-4" /> Supprimer le client
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditing(selectedClient); setSelectedClient(null); setOpen(true); }}>
                    Modifier
                  </Button>
                  <Button onClick={() => setSelectedClient(null)}>Fermer</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientDialog({ client, onSaved }: { client: Client | null; onSaved: () => void }) {
  const [first, setFirst] = useState(client?.first_name ?? "");
  const [last, setLast] = useState(client?.last_name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [member, setMember] = useState(client?.is_member ?? false);
  const [children, setChildren] = useState(client?.children_count ?? 0);
  const [notes, setNotes] = useState(client?.notes ?? "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      first_name: first,
      last_name: last || null,
      phone: phone || null,
      email: email || null,
      is_member: member,
      children_count: children,
      notes: notes || null,
    };
    try {
      if (client) {
        await updateClientAction({ data: { id: client.id, ...payload } });
      } else {
        await createClientAction({ data: payload });
      }
      toast.success("Client enregistré");
      onSaved();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-primary">
          {client ? "Modifier le client" : "Nouveau client"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Prénom *</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} required /></div>
          <div><Label>Nom</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={member} onCheckedChange={setMember} id="m" />
            <Label htmlFor="m">Adhérent réseau</Label>
          </div>
          <div><Label>Nombre d'enfants</Label><Input type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value) || 0)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        <DialogFooter>
          <Button type="submit">Enregistrer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
