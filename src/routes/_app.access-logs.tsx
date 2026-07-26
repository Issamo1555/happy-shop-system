import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-context'
import { Navigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getAccessLogsAction } from '@/lib/actions'
import { Shield, Clock, Mail, MonitorSmartphone, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_app/access-logs')({
  component: AccessLogsPage,
})

function AccessLogsPage() {
  const { isSuperAdmin } = useAuth()
  
  // Security check
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  const { data: logs, isLoading } = useQuery({
    queryKey: ['access-logs'],
    queryFn: async () => {
      return await getAccessLogsAction({ data: {} })
    },
    refetchInterval: 10000 // auto refresh every 10s
  })

  const extractIpAndDevice = (details: string) => {
    const ipMatch = details.match(/\[IP: (.*?)\]/);
    const deviceMatch = details.match(/\[Appareil: (.*?)\]/);
    const ip = ipMatch ? ipMatch[1] : "Inconnue";
    const device = deviceMatch ? deviceMatch[1] : "Inconnu";
    return { ip, device, raw: details.replace(/\[IP: .*?\] \[Appareil: .*?\]/, '').trim() };
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Journaux d'accès
          </h1>
          <p className="text-slate-500 mt-2">
            Historique de toutes les tentatives de connexion à l'application.
          </p>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg">Dernières connexions</CardTitle>
          <CardDescription>Affichage des 1000 dernières tentatives</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Date</div></TableHead>
                  <TableHead><div className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</div></TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead><div className="flex items-center gap-2"><MonitorSmartphone className="w-4 h-4" /> IP & Appareil</div></TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Chargement des logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      Aucun log trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log: any) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const dateObj = new Date(log.date);
                    const parsed = extractIpAndDevice(log.details);
                    
                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-medium text-slate-600">
                          {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} <br/>
                          <span className="text-xs text-slate-400">{dateObj.toLocaleTimeString('fr-FR')}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isSuccess ? "default" : "destructive"} className={isSuccess ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                            {isSuccess ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{parsed.ip}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]" title={parsed.device}>{parsed.device}</div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-[250px] truncate" title={parsed.raw}>
                          {parsed.raw}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
