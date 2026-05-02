import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTablesAction, getTableDataAction, importFromSupabaseAction } from "@/lib/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, CloudDownload, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/db-admin")({
  component: DBAdminPage,
});

function DBAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [supaEmail, setSupaEmail] = useState("");
  const [supaPass, setSupaPass] = useState("");
  const [isSupaAuth, setIsSupaAuth] = useState(false);

  // REDIRECT IF NOT ADMIN
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Accès réservé à l'administrateur");
      navigate({ to: "/caisse" });
    }
  }, [isAdmin, authLoading]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSupaAuth(!!session);
    });
  }, []);

  useEffect(() => {
    if (user?.id && isAdmin) {
      getTablesAction({ data: { adminId: user.id } }).then((res: any) => {
        const names = res.map((t: any) => t.name);
        setTables(names);
        if (names.length > 0) setSelectedTable(names[0]);
      });
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (selectedTable && user?.id && isAdmin) {
      setLoading(true);
      getTableDataAction({ data: { tableName: selectedTable, adminId: user.id } }).then((res: any) => {
        setData(res);
        setLoading(false);
      });
    }
  }, [selectedTable, user, isAdmin]);

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
      const { data: prods, error: pError } = await supabase.from("products").select("*");
      const { data: clients, error: cError } = await supabase.from("clients").select("*");

      if (pError || cError) throw new Error(pError?.message || cError?.message);

      await importFromSupabaseAction({ 
        data: { products: prods || [], clients: clients || [] } 
      });

      toast.success(`${prods?.length || 0} produits et ${clients?.length || 0} clients importés.`);
      if (selectedTable && user?.id) {
        const newData = await getTableDataAction({ data: { tableName: selectedTable, adminId: user.id } });
        setData(newData);
      }
    } catch (err: any) {
      toast.error("Erreur lors de l'importation: " + err.message);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const val = row[header] === null ? '' : row[header];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedTable}_export.csv`);
    link.click();
    toast.success("Export terminé");
  };

  if (!isAdmin) return null;

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
              <input type="email" placeholder="Email" className="text-xs p-1 rounded border w-32" value={supaEmail} onChange={e => setSupaEmail(e.target.value)} required />
              <input type="password" placeholder="Pass" className="text-xs p-1 rounded border w-32" value={supaPass} onChange={e => setSupaPass(e.target.value)} required />
              <Button type="submit" size="sm" variant="secondary" disabled={loading}>Connecter</Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleImport} disabled={loading}>
              <CloudDownload className="w-4 h-4" />
              Lancer l'importation
            </Button>
          )}

          <Button variant="outline" size="sm" className="gap-2" onClick={exportToCSV} disabled={data.length === 0}>
            <FileDown className="w-4 h-4" />
            Exporter Excel/CSV
          </Button>
          
          <div className="w-64">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map(col => <TableCell key={col} className="max-w-xs truncate">{String(row[col])}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
