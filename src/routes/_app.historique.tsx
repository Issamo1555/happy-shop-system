import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getSalesAction, getSaleItemsAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Receipt as ReceiptIcon, FileDown } from "lucide-react";
import { addDays, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDhs } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZReportModal } from "@/components/ZReportModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/historique")({
  component: HistoryPage,
});

interface Sale {
  id: string;
  created_at: string;
  cashier_id: string;
  client_id: string | null;
  subtotal: number;
  discount: number;
  discount_reason: string | null;
  total: number;
  payment_method: "cash" | "card" | "transfer" | "pack";
  note: string | null;
  clients: { first_name: string; last_name: string | null } | null;
}

interface SaleItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

const PAY_LABELS: Record<Sale["payment_method"], string> = {
  cash: "Espèces", card: "Carte", transfer: "Virement", pack: "Pack",
};

function HistoryPage() {
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [isZModalOpen, setIsZModalOpen] = useState(false);

  const load = async () => {
    const dayStr = format(day, "yyyy-MM-dd");
    const data = await getSalesAction({ data: dayStr });
    const mappedSales = (data as any[]).map((r: any) => ({
      ...r,
      clients: r.first_name ? { first_name: r.first_name, last_name: r.last_name } : null
    }));
    setSales(mappedSales as Sale[]);
  };
  useEffect(() => { load(); }, [day]);

  const openDetail = async (s: Sale) => {
    setOpened(s);
    const data = await getSaleItemsAction({ data: s.id });
    setItems(data as unknown as SaleItem[]);
  };

  const handleExport = () => {
    if (sales.length === 0) return;
    const headers = ["ID", "Heure", "Client", "Sous-total", "Remise", "Total", "Paiement", "Note"];
    const csvRows = [
      headers.join(','),
      ...sales.map(s => {
        const row = [
          s.id.slice(0, 8),
          format(new Date(s.created_at), "HH:mm"),
          s.clients ? `${s.clients.first_name} ${s.clients.last_name ?? ""}` : 'Anonyme',
          s.subtotal,
          s.discount,
          s.total,
          PAY_LABELS[s.payment_method],
          s.note || ""
        ];
        return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ventes_${format(day, "yyyy-MM-dd")}.csv`);
    link.click();
    toast.success("Historique exporté");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      `${s.clients?.first_name ?? ""} ${s.clients?.last_name ?? ""} ${s.note ?? ""}`
        .toLowerCase().includes(q)
    );
  }, [sales, search]);

  const totals = useMemo(() => {
    const total = sales.reduce((s, x) => s + Number(x.total), 0);
    const byMethod: Record<string, number> = {};
    sales.forEach((s) => {
      byMethod[s.payment_method] = (byMethod[s.payment_method] ?? 0) + Number(s.total);
    });
    return { total, count: sales.length, byMethod };
  }, [sales]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-primary flex-1">Historique des ventes</h1>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={sales.length === 0}>
            <FileDown className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsZModalOpen(true)}>
            <ReceiptIcon className="w-4 h-4" /> Rapport Z
          </Button>
        </div>

        <div className="flex items-center gap-1 pos-card p-1">
          <Button size="icon" variant="ghost" onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="px-3 text-sm font-medium min-w-[180px] text-center">
            {format(day, "EEEE d MMMM yyyy", { locale: fr })}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setDay(startOfDay(new Date()))}>Aujourd'hui</Button>
        </div>
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CA du jour</p>
          <p className="font-display text-3xl text-primary mt-1">{formatDhs(totals.total)}</p>
        </div>
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Nb tickets</p>
          <p className="font-display text-3xl mt-1">{totals.count}</p>
        </div>
        {(["cash", "card"] as const).map((m) => (
          <div key={m} className="pos-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{PAY_LABELS[m]}</p>
            <p className="font-display text-3xl mt-1">{formatDhs(totals.byMethod[m] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="pos-card divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ReceiptIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Aucune vente.
          </div>
        ) : (
          filtered.map((s) => (
            <button key={s.id} onClick={() => openDetail(s)} className="w-full p-4 flex items-center gap-4 hover:bg-muted/40 text-left transition-colors">
              <div className="text-center min-w-[64px]">
                <p className="font-mono text-sm">{format(new Date(s.created_at), "HH:mm")}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {s.clients ? `${s.clients.first_name} ${s.clients.last_name ?? ""}` : "Sans client"}
                </p>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
              <Badge variant="secondary">{PAY_LABELS[s.payment_method]}</Badge>
              {s.discount > 0 && <Badge className="bg-sage/30 text-sage-foreground">-{formatDhs(Number(s.discount))}</Badge>}
              <p className="font-display text-xl text-primary min-w-[100px] text-right">{formatDhs(Number(s.total))}</p>
            </button>
          ))
        )}
      </div>

      <Dialog open={!!opened} onOpenChange={(v) => !v && setOpened(null)}>
        <DialogContent>
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-primary">
                  Ticket #{opened.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">{format(new Date(opened.created_at), "PPPp", { locale: fr })}</p>
                {opened.clients && (
                  <p>Client : <strong>{opened.clients.first_name} {opened.clients.last_name ?? ""}</strong></p>
                )}
                <div className="border-t pt-3 space-y-1">
                  {items.map((i) => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.quantity}× {i.product_name}</span>
                      <span>{formatDhs(Number(i.line_total))}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between"><span>Sous-total</span><span>{formatDhs(Number(opened.subtotal))}</span></div>
                  {Number(opened.discount) > 0 && (
                    <div className="flex justify-between text-sage-foreground">
                      <span>Remise {opened.discount_reason ? `(${opened.discount_reason})` : ""}</span>
                      <span>-{formatDhs(Number(opened.discount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-xl text-primary pt-1">
                    <span>Total</span><span>{formatDhs(Number(opened.total))}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">Paiement : {PAY_LABELS[opened.payment_method]}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <ZReportModal 
        open={isZModalOpen} 
        onOpenChange={setIsZModalOpen}
        day={day}
        sales={sales}
        totals={totals}
      />
    </div>
  );
}
