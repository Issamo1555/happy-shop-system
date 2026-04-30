import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTablesAction, getTableDataAction, importFromSupabaseAction } from "@/lib/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/db-admin")({
  component: DBAdminPage,
});

function DBAdminPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [supaEmail, setSupaEmail] = useState("");
  const [supaPass, setSupaPass] = useState("");
  const [isSupaAuth, setIsSupaAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSupaAuth(!!session);
    });
  }, []);

  useEffect(() => {
    getTablesAction().then((res: any) => {
      const names = res.map((t: any) => t.name);
      setTables(names);
      if (names.length > 0) setSelectedTable(names[0]);
    });
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setLoading(true);
      getTableDataAction({ data: selectedTable }).then((res: any) => {
        setData(res);
        setLoading(false);
      });
    }
  }, [selectedTable]);

  const handleSupaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: supaEmail, password: supaPass });
    if (error) {
      toast.error("Erreur de connexion Supabase: " + error.message);
    } else {
      toast.success("Connecté à Supabase !");
      setIsSupaAuth(true);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      // Fetch from Supabase (client-side uses the user session)
      const { data: prods, error: pError } = await supabase.from("products").select("*");
      const { data: clients, error: cError } = await supabase.from("clients").select("*");

      if (pError || cError) {
        throw new Error(pError?.message || cError?.message);
      }

      if (!prods || prods.length === 0) {
        toast.info("Aucun produit trouvé sur Supabase.");
      }

      // Send to server to save in SQLite
      await importFromSupabaseAction({ 
        data: { 
          products: prods || [], 
          clients: clients || [] 
        } 
      });

      toast.success(`${prods?.length || 0} produits et ${clients?.length || 0} clients importés.`);
      
      if (selectedTable) {
        const newData = await getTableDataAction({ data: selectedTable });
        setData(newData);
      }
    } catch (err: any) {
      toast.error("Erreur lors de l'importation: " + err.message);
    }
    setLoading(false);
  };

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Database className="w-8 h-8" />
          Explorateur de Données
        </h1>
        
        <div className="flex items-center gap-4">
          {!isSupaAuth ? (
            <form onSubmit={handleSupaLogin} className="flex items-center gap-2 bg-muted p-2 rounded-lg">
              <span className="text-xs font-medium text-muted-foreground px-2">Migration Supabase:</span>
              <input 
                type="email" 
                placeholder="Email Supabase" 
                className="text-xs p-1 rounded border bg-background w-32"
                value={supaEmail}
                onChange={e => setSupaEmail(e.target.value)}
                required
              />
              <input 
                type="password" 
                placeholder="Mot de passe" 
                className="text-xs p-1 rounded border bg-background w-32"
                value={supaPass}
                onChange={e => setSupaPass(e.target.value)}
                required
              />
              <Button type="submit" size="sm" variant="secondary" disabled={loading}>Connecter</Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleImport} disabled={loading}>
              <CloudDownload className="w-4 h-4" />
              Lancer l'importation (Connecté)
            </Button>
          )}
          
          <div className="w-64">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="pos-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Chargement...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Table vide</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map(col => (
                    <TableCell key={col} className="max-w-xs truncate">
                      {String(row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
