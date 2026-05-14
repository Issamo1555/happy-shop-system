import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDhs } from "@/lib/format";
import { Printer, Receipt } from "lucide-react";

interface Sale {
  total: number;
  payment_method: string;
}

interface ZReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  sales: Sale[];
  totals: {
    total: number;
    count: number;
    byMethod: Record<string, number>;
  };
  settings: Record<string, string>;
}

const PAY_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  cheque: "Chèque",
  pack: "Pack",
};

export function ZReportModal({ open, onOpenChange, day, sales, totals, settings }: ZReportModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-[400px]">
        <DialogHeader className="print:hidden">
          <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Rapport Z du jour
          </DialogTitle>
        </DialogHeader>

        {/* PRINTABLE AREA */}
        <div className="space-y-6 py-4 font-mono text-sm print:m-0 print:p-0 print:block print-zone">
          <div className="flex flex-col items-center mb-4 text-center">
            <img src="/logo.png" alt="Logo" className="h-12 mb-2" />
            <div className="space-y-0.5">
              <h3 className="font-display text-lg font-bold text-primary">
                {settings.center_name || "Mums'Home"}
              </h3>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {settings.center_address || "Casablanca, Maroc"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Tél: {settings.center_phone || "+212 6 XX XX XX XX"}
              </p>
            </div>
          </div>
          <div className="border-y border-dashed border-black py-2 my-4 text-center">
            <p className="text-xs font-bold uppercase">RAPPORT Z - CLÔTURE</p>
            <p className="text-xs mt-1">
              Date : {format(day, "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="flex justify-between">
                <span>Total Brut</span>
                <span>{formatDhs(totals.total)}</span>
              </p>
              <p className="flex justify-between">
                <span>Nb Transactions</span>
                <span>{totals.count}</span>
              </p>
            </div>

            <div className="space-y-1 border-t border-dashed border-black pt-2">
              <p className="font-bold mb-2">VENTILATION PAR MODE :</p>
              {Object.entries(PAY_LABELS).map(([key, label]) => (
                <p key={key} className="flex justify-between">
                  <span>{label}</span>
                  <span>{formatDhs(totals.byMethod[key] ?? 0)}</span>
                </p>
              ))}
            </div>
            
            <div className="space-y-1 border-t border-dashed border-black pt-2">
              <p className="flex justify-between">
                <span>Total HT</span>
                <span>{formatDhs(totals.total / (1 + Number(settings.tva_percent || 20) / 100))}</span>
              </p>
              <p className="flex justify-between">
                <span>Total TVA ({settings.tva_percent || 20}%)</span>
                <span>{formatDhs(totals.total - (totals.total / (1 + Number(settings.tva_percent || 20) / 100)))}</span>
              </p>
            </div>

            <div className="border-t-2 border-black pt-2 flex justify-between font-bold text-lg">
              <span>TOTAL NET</span>
              <span>{formatDhs(totals.total)}</span>
            </div>
          </div>

          <div className="text-center pt-6 text-[10px] space-y-1">
            <p>Rapport généré le {format(new Date(), "Pp", { locale: fr })}</p>
            <p className="border-t border-black pt-1">*** Fin de rapport ***</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimer le Z
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
