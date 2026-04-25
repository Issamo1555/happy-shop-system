import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_LABELS, formatDhs } from "@/lib/format";
import { Plus, Pencil, Save, X, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/catalogue")({
  component: CataloguePage,
});

interface Product {
  id: string;
  name: string;
  category: string;
  type: "unit" | "pack" | "session";
  price: number;
  active: boolean;
  sort_order: number;
  pack_sessions: number | null;
}

function CataloguePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    category: "cafe",
    type: "unit",
    price: 0,
    active: true,
    sort_order: 0,
  });

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    
    if (error) {
      toast.error("Erreur lors du chargement des produits");
    } else {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleUpdate = async (id: string) => {
    const { error } = await supabase
      .from("products")
      .update(editForm)
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Produit mis à jour");
      setEditingId(null);
      fetchProducts();
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ active })
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors du changement d'état");
    } else {
      fetchProducts();
    }
  };

  const handleAdd = async () => {
    if (!newProduct.name || !newProduct.category || newProduct.price === undefined) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    const { error } = await supabase.from("products").insert([newProduct]);

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      toast.success("Produit ajouté");
      setIsAddOpen(false);
      setNewProduct({
        name: "",
        category: "cafe",
        type: "unit",
        price: 0,
        active: true,
        sort_order: 0,
      });
      fetchProducts();
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditForm(product);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary flex items-center gap-2">
            <Package className="w-8 h-8" />
            Catalogue & Prix
          </h1>
          <p className="text-muted-foreground">Gérez vos produits et tarifs</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Nom</Label>
                <Input
                  id="new-name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={newProduct.category}
                    onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-price">Prix (DHS)</Label>
                  <Input
                    id="new-price"
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newProduct.type}
                    onValueChange={(v: any) => setNewProduct({ ...newProduct, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit">Unité</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="session">Séance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-sort">Ordre</Label>
                  <Input
                    id="new-sort"
                    type="number"
                    value={newProduct.sort_order}
                    onChange={(e) => setNewProduct({ ...newProduct, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="pos-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun produit trouvé
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      <span className="font-medium">{product.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Select
                        value={editForm.category}
                        onValueChange={(v) => setEditForm({ ...editForm, category: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS] || product.category}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    ) : (
                      formatDhs(product.price)
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.active}
                        onCheckedChange={(checked) => handleToggleActive(product.id, checked)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {product.active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === product.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleUpdate(product.id)}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEditing(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
