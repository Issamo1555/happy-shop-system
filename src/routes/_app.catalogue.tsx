import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { uploadTicketImageAction, createProductAction, updateProductAction, toggleProductActiveAction, deleteProductAction, createCategoryAction, updateCategoryAction, deleteCategoryAction, getProductsAction, getCategoriesAction } from "@/lib/actions";
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
import { formatDhs } from "@/lib/format";
import { Plus, Pencil, Save, X, Package, Trash2, Search, Settings, Tag, ImagePlus, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  image_url?: string;
}

function CataloguePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    category: "",
    type: "unit",
    price: 0,
    active: true,
    sort_order: 0,
    pack_sessions: null,
    image_url: "",
  });

  const [isCategoryAddOpen, setIsCategoryAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<{name:string, sort_order:number, image_url?:string}>({ name: "", sort_order: 0, image_url: "" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState<Partial<Category>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAll = async () => {
    setLoading(true);
    try {
      console.log("🌐 Frontend: Appel de fetchAll...");
      const tenantData = { data: { tenantId: user?.tenant_id } };
      const [prodData, catData] = await Promise.all([
        getProductsAction(tenantData),
        getCategoriesAction(tenantData)
      ]);
      console.log("🌐 Frontend: Données reçues - Produits:", prodData?.length, "Catégories:", catData?.length);
      setProducts(prodData as Product[]);
      setCategories(catData as Category[] || []);
      
      if (catData.length > 0 && !newProduct.category) {
        setNewProduct(prev => ({ ...prev, category: catData[0].slug }));
      }
    } catch (err) {
      console.error("❌ Erreur fetchAll:", err);
      toast.error("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [user?.tenant_id]);

  const handleImageUpload = async (file: File, isProduct: boolean) => {
    if (!user) return null;
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onload = async () => {
        try {
          const res = await uploadTicketImageAction({
            data: {
              userId: user.id,
              base64: reader.result as string,
              filename: file.name
            }
          });
          if (res.url) {
            resolve(res.url);
          } else {
            reject("Erreur upload");
          }
        } catch(e) {
          reject(e);
        }
      };
      reader.onerror = () => reject("Erreur lecture fichier");
      reader.readAsDataURL(file);
    });
  };

  const fetchProducts = async () => {
    try {
      const data = await getProductsAction({ data: { tenantId: user?.tenant_id } });
      setProducts(data as Product[]);
    } catch (err) {
      toast.error("Erreur lors du chargement des produits");
    }
  };

  const handleUpdate = async (id: string) => {
    setLoading(true);
    try {
      await updateProductAction({ data: { id, adminId: user?.id, ...editForm } });
      toast.success("Produit mis à jour");
      setEditingId(null);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await toggleProductActiveAction({ data: { id, active, adminId: user?.id } });
      fetchProducts();
    } catch (err) {
      toast.error("Erreur lors du changement d'état");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.")) return;
    try {
      await deleteProductAction({ data: { id, adminId: user?.id } });
      toast.success("Produit supprimé");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  const handleAdd = async () => {
    if (!newProduct.name || !newProduct.category) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    setLoading(true);
    try {
      await createProductAction({ data: { ...newProduct, adminId: user?.id } });
      toast.success("Produit ajouté");
      setIsAddOpen(false);
      setNewProduct({
        name: "",
        category: "cafe",
        type: "unit",
        price: 0,
        active: true,
        sort_order: 0,
        pack_sessions: null,
      });
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditForm(product);
  };
  
  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    setLoading(true);
    try {
      await createCategoryAction({ data: { ...newCategory, adminId: user?.id } });
      toast.success("Catégorie ajoutée");
      setIsCategoryAddOpen(false);
      setNewCategory({ name: "", sort_order: 0, image_url: "" });
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    setLoading(true);
    try {
      await updateCategoryAction({ data: { id, ...editCategoryForm, adminId: user?.id } });
      toast.success("Catégorie mise à jour");
      setEditingCategoryId(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    try {
      await deleteCategoryAction({ data: { id, adminId: user?.id } });
      toast.success("Catégorie supprimée");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const categoryMap = Object.fromEntries(categories.map(c => [c.slug, c.name]));
  
  const filteredProducts = products.filter(p => {
    const searchTerm = search.toLowerCase();
    const categoryLabel = categoryMap[p.category] || p.category;
    return (
      p.name.toLowerCase().includes(searchTerm) ||
      categoryLabel.toLowerCase().includes(searchTerm)
    );
  });
  
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" /> Produits
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="w-4 h-4" /> Catégories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Rechercher un produit..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} 
                className="pl-9" 
              />
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
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.slug}>
                              {cat.name}
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
                  </div>
                  {newProduct.type === "pack" && (
                    <div className="space-y-2">
                      <Label htmlFor="new-sessions">Nombre de séances dans le pack</Label>
                      <Input
                        id="new-sessions"
                        type="number"
                        min={1}
                        placeholder="Ex: 10"
                        value={newProduct.pack_sessions || ""}
                        onChange={(e) => setNewProduct({ ...newProduct, pack_sessions: Number(e.target.value) || null })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Image du Produit</Label>
                    <div className="flex items-center gap-4">
                      {newProduct.image_url ? (
                        <div className="relative w-16 h-16 rounded border bg-muted flex items-center justify-center">
                          <img src={newProduct.image_url} alt="Aperçu" className="max-w-full max-h-full object-contain" />
                          <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 w-5 h-5 rounded-full" onClick={() => setNewProduct({...newProduct, image_url: ""})}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded border border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                          <ImagePlus className="w-6 h-6 mb-1" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              toast.loading("Upload de l'image...", { id: "upload-prod" });
                              try {
                                const url = await handleImageUpload(file, true);
                                setNewProduct({ ...newProduct, image_url: url });
                                toast.success("Image ajoutée", { id: "upload-prod" });
                              } catch(e) {
                                toast.error("Erreur d'upload", { id: "upload-prod" });
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleAdd} className="w-full" disabled={loading}>
                    {loading ? "Chargement..." : "Enregistrer"}
                  </Button>
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
                {loading && products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {editingId === product.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="h-8"
                            />
                            {editForm.type === "pack" && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs shrink-0">Séances :</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={editForm.pack_sessions || ""}
                                  onChange={(e) => setEditForm({ ...editForm, pack_sessions: Number(e.target.value) || null })}
                                  className="h-8 w-20"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {editForm.image_url ? (
                                <img src={editForm.image_url} alt="img" className="w-8 h-8 rounded border object-contain" />
                              ) : (
                                <div className="w-8 h-8 rounded border border-dashed flex items-center justify-center text-muted-foreground"><ImagePlus className="w-4 h-4"/></div>
                              )}
                              <Input 
                                type="file" 
                                accept="image/*" 
                                className="h-8 text-xs flex-1"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    toast.loading("Upload...", { id: "edit-prod" });
                                    try {
                                      const url = await handleImageUpload(file, true);
                                      setEditForm({ ...editForm, image_url: url });
                                      toast.success("Image modifiée", { id: "edit-prod" });
                                    } catch(err) {
                                      toast.error("Erreur", { id: "edit-prod" });
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            {product.type === "pack" && (
                              <span className="text-[10px] bg-primary/10 text-primary-dark font-semibold px-1.5 py-0.5 rounded w-max mt-0.5">
                                Pack de {product.pack_sessions || 0} séances
                              </span>
                            )}
                          </div>
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
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.slug}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{categoryMap[product.category] || product.category}</Badge>
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
                              disabled={loading}
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
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditing(product)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground mx-4">
                    Page {currentPage} sur {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Gestion des catégories</h2>
            <Dialog open={isCategoryAddOpen} onOpenChange={setIsCategoryAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Nouvelle catégorie
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter une catégorie</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat-name">Nom</Label>
                    <Input
                      id="cat-name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-sort">Ordre d'affichage</Label>
                    <Input
                      id="cat-sort"
                      type="number"
                      value={newCategory.sort_order || ""}
                      onChange={(e) => setNewCategory({ ...newCategory, sort_order: Number(e.target.value) || 0 })}
                    />
                  </div>
                    
                    <div className="space-y-2">
                      <Label>Image (Icône)</Label>
                      <div className="flex items-center gap-2">
                        {newCategory.image_url && <img src={newCategory.image_url} className="w-10 h-10 object-contain rounded border" alt="icon"/>}
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              toast.loading("Upload...", { id: "new-cat" });
                              try {
                                const url = await handleImageUpload(file, false);
                                setNewCategory({ ...newCategory, image_url: url });
                                toast.success("Image ajoutée", { id: "new-cat" });
                              } catch(err) {
                                toast.error("Erreur", { id: "new-cat" });
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <Button onClick={handleAddCategory} className="w-full mt-4" disabled={loading}>
                    {loading ? "Chargement..." : "Enregistrer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="pos-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Ordre</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      {editingCategoryId === cat.id ? (
                        <Input
                          value={editCategoryForm.name}
                          onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium">{cat.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cat.slug}</code>
                    </TableCell>
                    <TableCell>
                      {editingCategoryId === cat.id ? (
                        <Input
                          type="number"
                          value={editCategoryForm.sort_order}
                          onChange={(e) => setEditCategoryForm({ ...editCategoryForm, sort_order: Number(e.target.value) })}
                          className="h-8 w-20"
                        />
                      ) : (
                        cat.sort_order
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingCategoryId === cat.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => handleUpdateCategory(cat.id)}
                            disabled={loading}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setEditingCategoryId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => { setEditingCategoryId(cat.id); setEditCategoryForm(cat); }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
