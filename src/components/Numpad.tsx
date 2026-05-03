import { Button } from "./ui/button";
import { Delete, X, Check } from "lucide-react";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  onConfirm?: () => void;
  allowDecimal?: boolean;
  title?: string;
}

export function Numpad({ value, onChange, onClose, onConfirm, allowDecimal = true, title }: NumpadProps) {
  const append = (digit: string) => {
    if (digit === "." && value.includes(".")) return;
    if (value === "0" && digit !== ".") {
      onChange(digit);
    } else {
      onChange(value + digit);
    }
  };

  const backspace = () => {
    if (value.length <= 1) {
      onChange("0");
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const clear = () => onChange("0");

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0"];

  return (
    <div className="p-3 bg-card border rounded-xl shadow-xl w-64 select-none animate-in fade-in zoom-in duration-200">
      {title && <p className="text-xs font-medium text-muted-foreground mb-3 text-center uppercase tracking-wider">{title}</p>}
      
      <div className="bg-muted/50 rounded-lg p-3 mb-3 flex items-center justify-end">
        <span className="text-2xl font-display text-primary truncate">
          {value || "0"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          key ? (
            <Button
              key={key}
              variant="outline"
              className="h-14 text-xl font-medium hover:bg-primary-soft hover:text-primary transition-all active:scale-95"
              onClick={() => append(key)}
            >
              {key}
            </Button>
          ) : <div key="empty" />
        ))}
        
        <Button
          variant="outline"
          className="h-14 text-destructive hover:bg-destructive/10 transition-all active:scale-95"
          onClick={backspace}
        >
          <Delete className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          className="h-14 text-muted-foreground"
          onClick={clear}
        >
          C
        </Button>

        {onConfirm ? (
          <Button
            className="h-14 col-span-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            onClick={onConfirm}
          >
            <Check className="w-5 h-5 mr-2" /> Valider
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-14 col-span-2"
            onClick={onClose}
          >
            Fermer
          </Button>
        )}
      </div>
    </div>
  );
}
