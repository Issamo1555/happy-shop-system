import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAdminPricingOffersAction, createPricingOfferAction, updatePricingOfferAction, deletePricingOfferAction } from "@/lib/actions";

interface PricingOffer {
  id: string;
  title: string;
  price: number;
  billing_cycle: string;
  description: string;
  features: string;
  active: boolean;
  sort_order: number;
}

export function PricingOffersAdmin({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<PricingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PricingOffer | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState(""); // JSON string or line separated
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const fetchOffers = async () => {
    try {
      const res = await getAdminPricingOffersAction({ data: { userId } });
      setOffers(res);
    } catch (err: any) {
      toast.error("Erreur de chargement des offres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleOpenNew = () => {
    setEditing(null);
    setTitle("");
    setPrice("0");
    setBillingCycle("monthly");
    setDescription("");
    setFeatures("");
    setActive(true);
    setSortOrder("0");
    setOpen(true);
  };

  const handleOpenEdit = (offer: PricingOffer) => {
    setEditing(offer);
    setTitle(offer.title);
    setPrice(offer.price.toString());
    setBillingCycle(offer.billing_cycle);
    setDescription(offer.description || "");
    setFeatures(offer.features || "");
    setActive(offer.active);
    setSortOrder(offer.sort_order.toString());
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      if (editing) {
        await updatePricingOfferAction({
          data: {
            userId,
            id: editing.id,
            title,
            price: parseFloat(price),
            billing_cycle: billingCycle,
            description,
            features,
            active,
            sort_order: parseInt(sortOrder)
          }
        });
        toast.success("Offre mise à jour");
      } else {
        await createPricingOfferAction({
          data: {
            userId,
            title,
            price: parseFloat(price),
            billing_cycle: billingCycle,
            description,
            features,
            active,
            sort_order: parseInt(sortOrder)
          }
        });
        toast.success("Nouvelle offre créée");
      }
      setOpen(false);
      fetchOffers();
    } catch (err: any) {
      toast.error(err.message || "Erreur de sauvegarde");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette offre ?")) return;
    try {
      await deletePricingOfferAction({ data: { id, userId } });
      toast.success("Offre supprimée");
      fetchOffers();
    } catch (err: any) {
      toast.error("Erreur de suppression");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-display text-primary flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Plans d'Abonnement (SaaS)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Créez et gérez les offres tarifaires affichées sur votre page publique /pricing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNew} className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              Nouvelle Offre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
                <Tag className="w-5 h-5" />
                {editing ? "Modifier l'offre" : "Créer une offre"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titre (Ex: START, PRO)</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: PRO" />
                </div>
                <div className="space-y-2">
                  <Label>Prix (DH)</Label>
                  <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Cycle de facturation</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={billingCycle} 
                    onChange={e => setBillingCycle(e.target.value)}
                  >
                    <option value="monthly">Mensuel (/mois)</option>
                    <option value="yearly">Annuel (/an)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Ordre d'affichage</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description Courte</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Pour les petits cabinets..." />
              </div>
              <div className="space-y-2">
                <Label>Fonctionnalités (Une par ligne)</Label>
                <Textarea value={features} onChange={e => setFeatures(e.target.value)} placeholder="1 Utilisateur&#10;Caisse tactile&#10;Agenda" className="min-h-[100px]" />
              </div>
              <div className="flex items-center gap-3 pt-4 border-t">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label>Offre Publique (Visible sur la page)</Label>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Enregistrer l'offre</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Ordre</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map(o => (
              <TableRow key={o.id}>
                <TableCell className="text-muted-foreground">{o.sort_order}</TableCell>
                <TableCell className="font-semibold text-primary">{o.title}</TableCell>
                <TableCell className="font-display font-medium text-lg">{o.price} DH <span className="text-sm text-muted-foreground font-sans">/ {o.billing_cycle === 'monthly' ? 'mois' : 'an'}</span></TableCell>
                <TableCell>
                  <Badge variant={o.active ? 'default' : 'secondary'}>{o.active ? 'Publique' : 'Cachée'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(o)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(o.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {offers.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Aucune offre commerciale configurée.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
