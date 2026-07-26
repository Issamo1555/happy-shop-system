import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-context'
import { Navigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getAccessLogsAction, getActiveUsersAction } from '@/lib/actions'
import { Shield, Clock, Mail, MonitorSmartphone, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react'
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

  const [logs, setLogs] = useState<any[]>([])
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsData, activeUsersData] = await Promise.all([
          getAccessLogsAction({ data: {} }),
          getActiveUsersAction({ data: {} })
        ])
        setLogs(logsData)
        setActiveUsers(activeUsersData)
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

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
            Supervision & Sécurité
          </h1>
          <p className="text-slate-500 mt-2">
            Supervisez les accès de vos collaborateurs et l'état de l'application en temps réel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Access Logs */}
        <div className="lg:col-span-2">
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
                      <TableHead className="w-[150px]"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Date</div></TableHead>
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
                            <TableCell className="font-medium text-slate-600 text-xs">
                              {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} <br/>
                              <span className="text-xs text-slate-400">{dateObj.toLocaleTimeString('fr-FR')}</span>
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {log.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant={isSuccess ? "default" : "destructive"} className={isSuccess ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                                {isSuccess ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{parsed.ip}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={parsed.device}>{parsed.device}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={parsed.raw}>
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

        {/* Right column: Active Users */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-md overflow-hidden bg-white/80 backdrop-blur-md">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-500" />
                Collaborateurs en ligne
              </CardTitle>
              <CardDescription>Activité détectée ces 5 dernières minutes</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 gap-2 text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Vérification de l'activité...
                </div>
              ) : activeUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Aucun utilisateur connecté récemment.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeUsers.map((activeUser: any) => {
                    const timeDiff = Math.max(0, Math.floor((Date.now() - activeUser.lastActive) / 1000));
                    let relativeTime = "Actif(ve) à l'instant";
                    if (timeDiff >= 60) {
                      relativeTime = `Il y a ${Math.floor(timeDiff / 60)} min`;
                    }

                    return (
                      <div key={activeUser.email} className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:shadow-sm transition-shadow">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            <h4 className="font-semibold text-sm text-slate-800">{activeUser.name}</h4>
                          </div>
                          <p className="text-xs text-slate-500">{activeUser.email}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal capitalize">
                              {activeUser.role}
                            </Badge>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{activeUser.tenant}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          {relativeTime}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
