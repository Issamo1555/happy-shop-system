import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getProductsAction, getClientsAction, saveSaleAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CATEGORY_LABELS, CATEGORY_ORDER, formatDhs } from "@/lib/format";
import { Plus, Minus, Trash2, ShoppingBag, Receipt, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/caisse")({
  component: CaissePage,
});

interface Product {
  id: string;
  name: string;
  category: string;
  type: "unit" | "pack" | "session";
  price: number;
  pack_sessions: number | null;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string | null;
  is_member: boolean;
  children_count: number;
}

type PaymentMethod = "cash" | "card" | "transfer" | "pack";

function CaissePage() {
  const { user } = useAuth();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeCat, setActiveCat] = useState<string>(CATEGORY_ORDER[0]);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<null | {
    items: typeof cart.items;
    subtotal: number;
    discount: number;
    total: number;
    clientName?: string;
    when: Date;
  }>(null);

  useEffect(() => {
    (async () => {
      const prods = await getProductsAction();
      setProducts(prods as unknown as Product[]);
      
      const cls = await getClientsAction();
      setClients(cls as unknown as Client[]);
    })();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  // Auto-discount: adhérent -10%, fratrie 2 enfants -5%, 3+ -10% (non cumulables)
  const autoDiscount = useMemo(() => {
    if (!selectedClient) return { pct: 0, reason: "" };
    const eligible = cart.items.filter((i) =>
      ["periscolaire", "laep"].includes(i.category)
    );
    const eligibleSubtotal = eligible.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    if (eligibleSubtotal <= 0) return { pct: 0, reason: "" };
    let pct = 0;
    let reason = "";
    if (selectedClient.is_member) {
      pct = 10;
      reason = "Adhérent réseau -10%";
    }
    if (selectedClient.children_count >= 3 && pct < 10) {
      pct = 10;
      reason = "Fratrie 3+ enfants -10%";
    } else if (selectedClient.children_count === 2 && pct < 5) {
      pct = 5;
      reason = "Fratrie 2 enfants -5%";
    }
    return { pct, reason, eligibleSubtotal };
  }, [selectedClient, cart.items]);

  const autoDiscountAmount = useMemo(() => {
    if (!autoDiscount.pct || !autoDiscount.eligibleSubtotal) return 0;
    return Math.round(autoDiscount.eligibleSubtotal * autoDiscount.pct) / 100;
  }, [autoDiscount]);

  const totalDiscount = autoDiscountAmount + (extraDiscount || 0);
  const total = Math.max(0, cart.subtotal - totalDiscount);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) return p.name.toLowerCase().includes(q);
      return p.category === activeCat;
    });
  }, [products, activeCat, search]);

  const categoriesPresent = CATEGORY_ORDER;

  const validateSale = async () => {
    if (!user) return;
    if (cart.items.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    setSubmitting(true);
    try {
      const discountReason = [autoDiscount.reason, extraDiscount > 0 ? `Remise manuelle ${extraDiscount} DHS` : ""]
        .filter(Boolean)
        .join(" + ") || null;

      const saleData = {
        sale: {
          cashier_id: user.id,
          client_id: clientId || null,
          subtotal: cart.subtotal,
          discount: totalDiscount,
          discount_reason: discountReason,
          total,
          payment_method: paymentMethod,
          note: note || null,
        },
        items: cart.items.map(i => ({
          product_id: i.productId,
          product_name: i.name,
          unit_price: i.unitPrice,
          quantity: i.quantity,
          line_total: i.unitPrice * i.quantity
        }))
      };

      await saveSaleAction({ data: saleData });

      // Si client + pack acheté, créer un client_pack localement (optionnel mais recommandé pour suivi offline)
      // Note: Le schéma local actuel ne gère pas encore client_packs, on pourrait l'ajouter si besoin

      setLastTicket({
        items: [...cart.items],
        subtotal: cart.subtotal,
        discount: totalDiscount,
        total,
        clientName: selectedClient
          ? `${selectedClient.first_name} ${selectedClient.last_name ?? ""}`.trim()
          : undefined,
        when: new Date(),
      });
      cart.clear();
      setExtraDiscount(0);
      setNote("");
      setClientId("");
      toast.success("Vente enregistrée");
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
      {/* CATALOG */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-primary flex-1">Caisse</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>

        {!search && (
          <Tabs value={activeCat} onValueChange={setActiveCat}>
            <ScrollArea className="w-full">
              <TabsList className="h-auto flex-wrap justify-start bg-muted/40">
                {categoriesPresent.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs">
                    {CATEGORY_LABELS[c]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                cart.add({
                  productId: p.id,
                  name: p.name,
                  unitPrice: Number(p.price),
                  category: p.category,
                  type: p.type,
                  packSessions: p.pack_sessions,
                })
              }
              className="pos-card p-4 text-left hover:border-primary hover:-translate-y-0.5 transition-all flex flex-col gap-2"
            >
              <Badge variant="secondary" className="self-start text-[10px]">
                {CATEGORY_LABELS[p.category]}
              </Badge>
              <p className="font-medium text-sm leading-tight flex-1">{p.name}</p>
              <p className="font-display text-xl text-primary">{formatDhs(Number(p.price))}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-12">Aucun produit</p>
          )}
        </div>
      </section>

      {/* CART / TICKET */}
      <aside className="space-y-4 lg:sticky lg:top-20 self-start">
        <div className="pos-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl">Panier</h2>
            {cart.items.length > 0 && (
              <Badge className="ml-auto" variant="secondary">
                {cart.items.length} {cart.items.length > 1 ? "articles" : "article"}
              </Badge>
            )}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-auto">
            {cart.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Cliquez sur un produit pour l'ajouter
              </p>
            ) : (
              cart.items.map((i) => (
                <div key={i.productId} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDhs(i.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.setQty(i.productId, i.quantity - 1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{i.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.setQty(i.productId, i.quantity + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => cart.remove(i.productId)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">Client (optionnel)</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sans client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sans client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name ?? ""}
                      {c.is_member ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Paiement</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="card">Carte</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="pack">Pack séance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Remise extra (DHS)</Label>
                <Input
                  type="number"
                  min={0}
                  value={extraDiscount || ""}
                  onChange={(e) => setExtraDiscount(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <Textarea
              placeholder="Note (optionnel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />

            <div className="space-y-1 pt-3 border-t border-border">
              <div className="flex justify-between text-sm">
                <span>Sous-total</span>
                <span>{formatDhs(cart.subtotal)}</span>
              </div>
              {autoDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-sage-foreground">
                  <span>{autoDiscount.reason}</span>
                  <span>-{formatDhs(autoDiscountAmount)}</span>
                </div>
              )}
              {extraDiscount > 0 && (
                <div className="flex justify-between text-sm text-sage-foreground">
                  <span>Remise manuelle</span>
                  <span>-{formatDhs(extraDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-display text-2xl text-primary pt-2">
                <span>Total</span>
                <span>{formatDhs(total)}</span>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base"
              disabled={submitting || cart.items.length === 0}
              onClick={validateSale}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {submitting ? "Enregistrement..." : "Encaisser"}
            </Button>
          </div>
        </div>

        {lastTicket && (
          <div className="pos-card p-5 border-sage">
            <h3 className="font-display text-lg mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sage-foreground" /> Dernier ticket
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {lastTicket.when.toLocaleString("fr-FR")}
              {lastTicket.clientName ? ` · ${lastTicket.clientName}` : ""}
            </p>
            <div className="text-sm space-y-1 mb-3">
              {lastTicket.items.map((i) => (
                <div key={i.productId} className="flex justify-between">
                  <span>{i.quantity}× {i.name}</span>
                  <span>{formatDhs(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Total payé</span>
              <span className="text-primary">{formatDhs(lastTicket.total)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => window.print()}
            >
              Imprimer le ticket
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
