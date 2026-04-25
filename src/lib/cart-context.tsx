import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  category: string;
  packSessions?: number | null;
  type: "unit" | "pack" | "session";
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add: CartState["add"] = (item) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === item.productId ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const remove: CartState["remove"] = (id) =>
    setItems((prev) => prev.filter((p) => p.productId !== id));
  const setQty: CartState["setQty"] = (id, qty) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.productId !== id)
        : prev.map((p) => (p.productId === id ? { ...p, quantity: qty } : p))
    );
  const clear = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
