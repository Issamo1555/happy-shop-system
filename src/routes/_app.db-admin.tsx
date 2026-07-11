import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTablesAction, getTableDataAction, downloadDatabaseAction } from "@/lib/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, FileDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

  // REDIRECT IF NOT ADMIN
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Accès réservé à l'administrateur");
      navigate({ to: "/caisse" });
    }
  }, [isAdmin, authLoading]);

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

  const handleBackup = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await downloadDatabaseAction({ data: { adminId: user.id } });
      const blob = new Blob([Uint8Array.from(atob(res.content), c => c.charCodeAt(0))], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename);
      link.click();
      toast.success("Sauvegarde de la base de données réussie");
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    }
    setLoading(false);
  };

  if (!isAdmin) return null;

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Database className="w-8 h-8" />
          Explorateur de Données (Local)
        </h1>
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="gap-2 text-sage border-sage/50 hover:bg-sage/10" onClick={handleBackup} disabled={loading}>
            <ShieldCheck className="w-4 h-4" />
            Sauvegarde (.db)
          </Button>

          <Button variant="outline" size="sm" className="gap-2" onClick={exportToCSV} disabled={data.length === 0}>
            <FileDown className="w-4 h-4" />
            Exporter CSV
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
                  {columns.map(col => <TableCell key={col} className="max-w-xs truncate text-xs">{String(row[col])}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
