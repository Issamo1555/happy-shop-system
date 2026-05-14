import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getProductsAction, getClientsAction, saveSaleAction, getSettingsAction, getCategoriesAction } from "@/lib/actions";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_LABELS, CATEGORY_ORDER, formatDhs } from "@/lib/format";
import { Plus, Minus, Trash2, ShoppingBag, Receipt, Search, Calculator, Banknote, Camera, ImageIcon, X } from "lucide-react";
import { Numpad } from "@/components/Numpad";
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

type PaymentMethod = "cash" | "card" | "transfer" | "cheque" | "pack";

function CaissePage() {
  const { user } = useAuth();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [paymentImage, setPaymentImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [lastTicket, setLastTicket] = useState<null | {
    items: typeof cart.items;
    subtotal: number;
    discount: number;
    total: number;
    clientName?: string;
    when: Date;
  }>(null);

  const [numpadValue, setNumpadValue] = useState("0");

  useEffect(() => {
    (async () => {
      const [prods, cls, sett, cats] = await Promise.all([
        getProductsAction(),
        getClientsAction(),
        getSettingsAction(),
        getCategoriesAction()
      ]);
      setProducts(prods as unknown as Product[]);
      setClients(cls as unknown as Client[]);
      setSettings(sett as Record<string, string>);
      setDbCategories(cats as any[]);
      if (cats && (cats as any[]).length > 0) {
        setActiveCat((cats as any[])[0].slug);
      }
      console.log("Caisse loaded settings:", sett);
    })();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

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
      pct = Number(settings.member_discount_percent) || 10;
      reason = `Adhérent réseau -${pct}%`;
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

  const changeToReturn = Math.max(0, cashReceived - total);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) return p.name.toLowerCase().includes(q);
      return p.category === activeCat;
    });
  }, [products, activeCat, search]);

  const categoriesPresent = dbCategories.length > 0 ? dbCategories : CATEGORY_ORDER.map(c => ({ slug: c, name: CATEGORY_LABELS[c] }));

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
          payment_image: paymentImage,
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
      setPaymentImage(null);
      setCashReceived(0);
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
                {categoriesPresent.map((c: any) => (
                  <TabsTrigger key={c.slug || c} value={c.slug || c} className="text-xs">
                    {c.name || CATEGORY_LABELS[c] || c}
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
                {dbCategories.find(c => c.slug === p.category)?.name || CATEGORY_LABELS[p.category] || p.category}
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
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-7 w-8 p-0 text-sm font-medium">
                          {i.quantity}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 border-0 shadow-none w-auto" side="left">
                        <Numpad 
                          value={String(i.quantity)} 
                          title="Quantité"
                          allowDecimal={false}
                          onChange={(v) => cart.setQty(i.productId, Number(v) || 1)} 
                        />
                      </PopoverContent>
                    </Popover>

                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.setQty(i.productId, i.quantity + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-1" onClick={() => cart.remove(i.productId)}>
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
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="pack">Pack séance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Remise extra (DHS)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={extraDiscount || ""}
                    onChange={(e) => setExtraDiscount(Number(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0"><Calculator className="w-4 h-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 border-0 shadow-none w-auto">
                      <Numpad 
                        value={String(extraDiscount)} 
                        title="Remise"
                        onChange={(v) => setExtraDiscount(Number(v) || 0)} 
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {paymentMethod === "cash" && (
              <div className="p-3 bg-primary-soft/30 rounded-lg border border-primary/10 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-primary">Calculateur de monnaie</Label>
                  <Banknote className="w-4 h-4 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground">Reçu</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-10 justify-start font-display text-lg">
                          {formatDhs(cashReceived)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 border-0 shadow-none w-auto">
                        <Numpad 
                          value={String(cashReceived)} 
                          title="Montant Reçu"
                          onChange={(v) => setCashReceived(Number(v) || 0)} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground">À rendre</p>
                    <div className="h-10 flex items-center font-display text-xl text-primary font-bold">
                      {formatDhs(changeToReturn)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Preuve de paiement (ex: Chèque)</Label>
              <div className="flex gap-2 items-center">
                <Button 
                  variant="outline" 
                  className={`flex-1 h-10 border-dashed ${paymentImage ? "border-sage bg-sage/5 text-sage" : "border-border"}`}
                  onClick={() => document.getElementById("payment-upload")?.click()}
                >
                  {paymentImage ? (
                    <><ImageIcon className="w-4 h-4 mr-2" /> Image chargée</>
                  ) : (
                    <><Camera className="w-4 h-4 mr-2" /> Prendre / Joindre une photo</>
                  )}
                </Button>
                {paymentImage && (
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive" onClick={() => setPaymentImage(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <input 
                  id="payment-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPaymentImage(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
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
              className="w-full h-12 text-base shadow-lg shadow-primary/20"
              disabled={submitting || cart.items.length === 0}
              onClick={validateSale}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {submitting ? "Enregistrement..." : "Encaisser"}
            </Button>
          </div>
        </div>

        {lastTicket && (
          <div className="pos-card p-6 border-sage animate-in slide-in-from-bottom duration-300 print-zone">
            {/* TICKET HEADER */}
            <div className="flex flex-col items-center mb-6 text-center">
              <img src="/logo.png" alt="Mums'Home" className="h-16 mb-2" />
              <div className="space-y-1">
                <h3 className="font-display text-2xl font-bold text-primary leading-none">Mums'Home</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-sans">Parentalité & Co</p>
              </div>
              <div className="mt-4 text-[10px] text-muted-foreground uppercase tracking-wider space-y-0.5">
                <p>{settings.center_name || "Centre de Bien-être & Accompagnement"}</p>
                <p>{settings.center_address || "Casablanca, Maroc"}</p>
                <p>Tél: {settings.center_phone || "+212 6 XX XX XX XX"}</p>
              </div>
            </div>

            {/* TICKET INFO */}
            <div className="border-y border-dashed border-border py-3 mb-4 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{lastTicket.when.toLocaleDateString("fr-FR")} {lastTicket.when.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Ticket #{Math.floor(Math.random() * 10000)}</span>
            </div>

            {/* CLIENT INFO */}
            {lastTicket.clientName && (
              <div className="mb-4 text-xs">
                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Client</p>
                <p className="font-medium">{lastTicket.clientName}</p>
              </div>
            )}

            {/* ITEMS */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-[10px] uppercase text-muted-foreground font-bold border-b pb-1">
                <span>Description</span>
                <span>Total</span>
              </div>
              {lastTicket.items.map((i) => (
                <div key={i.productId} className="flex justify-between items-start text-sm">
                  <div className="pr-4">
                    <p className="font-medium leading-tight">{i.name}</p>
                    <p className="text-[11px] text-muted-foreground">{i.quantity} x {formatDhs(i.unitPrice)}</p>
                  </div>
                  <span className="font-medium">{formatDhs(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>

            {/* TOTALS */}
            <div className="space-y-2 border-t border-dashed border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span>{formatDhs(lastTicket.subtotal)}</span>
              </div>
              {lastTicket.discount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Remises</span>
                  <span>-{formatDhs(lastTicket.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-2">
                <span className="font-display text-lg font-bold">TOTAL</span>
                <span className="font-display text-3xl font-bold text-primary">{formatDhs(lastTicket.total)}</span>
              </div>
            </div>

            {/* FOOTER */}
            <div className="mt-10 pt-6 border-t border-border text-center space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium">Merci de votre visite !</p>
                <p className="text-[10px] text-muted-foreground">À bientôt chez Mums'Home</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                  <p className="text-[8px] text-muted-foreground text-center px-1">QR CODE<br/>BIENTÔT</p>
                </div>
                <p className="text-[9px] text-muted-foreground">www.mumshome.ma</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-6 no-print"
              onClick={() => window.print()}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Imprimer le ticket professionnel
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
