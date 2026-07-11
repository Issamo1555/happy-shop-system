import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTicketsAction, createTicketAction, updateTicketStatusAction, uploadTicketImageAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MessageSquare, ShieldAlert, LifeBuoy, FileText, CheckCircle2, Clock, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tickets")({
  component: TicketsPage,
});

interface Ticket {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const TICKET_TYPES = {
  feature: { label: "Demande de fonctionnalité", color: "bg-blue-100 text-blue-800 border-blue-200" },
  bug: { label: "Signalement de bug", color: "bg-red-100 text-red-800 border-red-200" },
  complaint: { label: "Réclamation / Plainte", color: "bg-amber-100 text-amber-800 border-amber-200" },
  other: { label: "Autre demande", color: "bg-gray-100 text-gray-800 border-gray-200" },
};

const TICKET_STATUSES = {
  open: { label: "Ouvert", color: "bg-green-100 text-green-800", icon: Clock },
  in_progress: { label: "En cours", color: "bg-indigo-100 text-indigo-800", icon: Play },
  closed: { label: "Résolu / Fermé", color: "bg-gray-100 text-gray-800", icon: CheckCircle2 },
};

function TicketsPage() {
  const { user, isAdmin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [type, setType] = useState<string>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getTicketsAction({ data: { userId: user.id } });
      setTickets((data ?? []) as Ticket[]);
    } catch (err: any) {
      toast.error("Erreur lors de la récupération des tickets: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Le fichier est trop lourd (max 5Mo)");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Veuillez remplir le titre et la description");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;

      // Handle image upload if selected
      if (file && previewUrl) {
        const uploadRes = await uploadTicketImageAction({
          data: {
            userId: user?.id,
            base64: previewUrl,
            filename: file.name,
          },
        });
        imageUrl = uploadRes.url;
      }

      await createTicketAction({
        data: {
          userId: user?.id,
          type,
          title,
          description,
          image_url: imageUrl,
        },
      });

      toast.success("Ticket créé avec succès !");
      setTitle("");
      setDescription("");
      setType("bug");
      setFile(null);
      setPreviewUrl(null);
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erreur lors de la création du ticket: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    if (!user?.id) return;
    try {
      await updateTicketStatusAction({
        data: {
          ticketId,
          status: newStatus,
          adminId: user.id,
        },
      });
      toast.success("Statut du ticket mis à jour");
      load();
    } catch (err: any) {
      toast.error("Erreur de mise à jour: " + err.message);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.user_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-primary font-bold">Tickets & Réclamations</h1>
          <p className="text-muted-foreground text-sm">
            Signalez un problème, proposez des améliorations ou faites une réclamation.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Nouveau Ticket</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-primary">Créer un nouveau ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="ticket-type">Type de demande</Label>
                <select
                  id="ticket-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="bug">Signalement de bug 🐛</option>
                  <option value="feature">Nouvelle fonctionnalité 🚀</option>
                  <option value="complaint">Réclamation / Plainte ⚠️</option>
                  <option value="other">Autre demande 💬</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ticket-title">Titre</Label>
                <Input
                  id="ticket-title"
                  placeholder="Ex: Problème d'impression du reçu"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ticket-desc">Description</Label>
                <Textarea
                  id="ticket-desc"
                  placeholder="Veuillez décrire votre demande en détail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-attachment">Pièce jointe / Capture d'écran (max 5Mo)</Label>
                <Input
                  id="ticket-attachment"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="text-xs"
                />
                {previewUrl && (
                  <div className="mt-2 relative rounded-lg border overflow-hidden max-h-40 bg-accent flex items-center justify-center">
                    <img src={previewUrl} alt="Aperçu" className="max-h-40 object-contain w-full" />
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Création..." : "Envoyer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par titre, description ou utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {/* Liste des tickets */}
      {filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-dashed border-border text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground">Aucun ticket trouvé</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search ? "Modifiez votre recherche pour trouver d'autres résultats." : "Vous n'avez pas encore créé de ticket."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => {
            const typeConfig = TICKET_TYPES[ticket.type as keyof typeof TICKET_TYPES] || TICKET_TYPES.other;
            const statusConfig = TICKET_STATUSES[ticket.status as keyof typeof TICKET_STATUSES] || TICKET_STATUSES.open;
            const StatusIcon = statusConfig.icon;

            return (
              <div key={ticket.id} className="pos-card p-5 flex flex-col justify-between space-y-4 relative group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="outline" className={`${typeConfig.color} border px-2 py-0.5`}>
                      {typeConfig.label}
                    </Badge>
                    <Badge variant="secondary" className={`${statusConfig.color} flex items-center gap-1`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig.label}</span>
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {ticket.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Créé par <span className="font-medium text-foreground">{ticket.user_name}</span> le{" "}
                      {new Date(ticket.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
                    {ticket.description}
                  </p>

                  {ticket.image_url && (
                    <div className="mt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                            <FileText className="w-3.5 h-3.5" />
                            Voir la capture d'écran
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl bg-white/95 backdrop-blur-md">
                          <DialogHeader>
                            <DialogTitle className="text-primary font-display">{ticket.title}</DialogTitle>
                          </DialogHeader>
                          <div className="flex items-center justify-center p-2 rounded-lg border bg-accent/30 max-h-[70vh] overflow-hidden">
                            <img
                              src={ticket.image_url}
                              alt={ticket.title}
                              className="max-h-[60vh] object-contain w-full rounded"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>

                {/* Actions Administrateur */}
                {isAdmin && (
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Mode Admin
                    </span>
                    <div className="flex gap-1.5">
                      {ticket.status !== "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => handleStatusChange(ticket.id, "in_progress")}
                        >
                          Prendre en charge
                        </Button>
                      )}
                      {ticket.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
                          onClick={() => handleStatusChange(ticket.id, "closed")}
                        >
                          Résoudre
                        </Button>
                      )}
                      {ticket.status !== "open" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => handleStatusChange(ticket.id, "open")}
                        >
                          Réouvrir
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
