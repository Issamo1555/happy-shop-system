import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-context'
import { Navigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getAccessLogsAction, getActiveUsersAction } from '@/lib/actions'
import { Shield, Clock, Mail, MonitorSmartphone, AlertCircle, CheckCircle2, UserCheck, RefreshCw, Search, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const fetchData = async (silent = false) => {
    if (!silent) setIsRefreshing(true)
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
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 8000)
    return () => clearInterval(interval)
  }, [])

  const extractIpAndDevice = (details: string) => {
    const ipMatch = details.match(/\[IP: (.*?)\]/);
    const deviceMatch = details.match(/\[Appareil: (.*?)\]/);
    const ip = ipMatch ? ipMatch[1] : "Inconnue";
    const device = deviceMatch ? deviceMatch[1] : "Inconnu";
    
    // Format device string to be more readable
    let readableDevice = device;
    if (device.includes("Mobi")) {
      readableDevice = "📱 Mobile / Tablette";
    } else if (device.includes("Windows") || device.includes("Macintosh") || device.includes("Linux")) {
      readableDevice = "💻 Ordinateur / PC";
    }
    
    return { 
      ip, 
      device: readableDevice, 
      deviceFull: device,
      raw: details.replace(/\[IP: .*?\] \[Appareil: .*?\]/, '').trim() 
    };
  }

  // Filter & Sort
  const filteredLogs = logs
    .filter(log => {
      const matchesSearch = 
        log.email.toLowerCase().includes(filterText.toLowerCase()) ||
        log.details.toLowerCase().includes(filterText.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'ALL' || 
        log.status === statusFilter;
        
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      
      {/* Header section with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-primary p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            Super-Administration
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Supervision & Sécurité
          </h1>
          <p className="text-slate-300 max-w-xl text-sm md:text-base leading-relaxed">
            Consultez les tentatives d'accès en temps réel et surveillez l'état d'activité de vos collaborateurs.
          </p>
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Access Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Filters card */}
          <Card className="border-none shadow-sm bg-white/80 backdrop-blur-md rounded-xl">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par email, IP..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="pl-9 bg-white border-slate-200 focus-visible:ring-primary rounded-lg text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-xs">
                  {(['ALL', 'SUCCESS', 'FAILED'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        statusFilter === status 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {status === 'ALL' ? 'Tous' : status === 'SUCCESS' ? 'Succès' : 'Échecs'}
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  title="Trier par date"
                  className="rounded-lg border-slate-200"
                >
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchData()}
                  disabled={isRefreshing}
                  className="rounded-lg border-slate-200"
                >
                  <RefreshCw className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table Card */}
          <Card className="border-none shadow-md overflow-hidden bg-white/90 backdrop-blur-md rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/80 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Historique des tentatives</CardTitle>
                  <CardDescription>Rafraîchissement automatique toutes les 8s</CardDescription>
                </div>
                <Badge variant="outline" className="bg-white/50 text-slate-600 font-semibold px-2.5 py-1">
                  {filteredLogs.length} résultat{filteredLogs.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow className="border-slate-100">
                      <TableHead className="w-[160px] font-semibold text-slate-600 text-xs">Date & Heure</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-xs">Utilisateur</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-xs">Statut</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-xs">IP & Appareil</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-xs">Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium text-slate-400">Chargement des données de sécurité...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-slate-400 text-sm">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          Aucune tentative trouvée pour ces filtres.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => {
                        const isSuccess = log.status === 'SUCCESS';
                        const dateObj = new Date(log.date);
                        const parsed = extractIpAndDevice(log.details);
                        
                        return (
                          <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                            <TableCell className="font-medium text-slate-600 text-xs py-3.5">
                              {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} <br/>
                              <span className="text-slate-400 text-[11px] font-normal">{dateObj.toLocaleTimeString('fr-FR')}</span>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800 text-sm">
                              {log.email}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={isSuccess ? "default" : "destructive"} 
                                className={`font-semibold px-2 py-0.5 rounded-full text-[10px] tracking-wide inline-flex items-center gap-1 ${
                                  isSuccess 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {isSuccess ? 'RÉUSSI' : 'ÉCHEC'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-bold text-slate-700">{parsed.ip}</div>
                              <div className="text-[10px] text-slate-400 font-medium max-w-[130px] truncate" title={parsed.deviceFull}>{parsed.device}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[180px] truncate" title={parsed.raw}>
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
          <Card className="border-none shadow-md overflow-hidden bg-white/90 backdrop-blur-md rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <UserCheck className="w-5 h-5 text-emerald-500" />
                Collaborateurs connectés
              </CardTitle>
              <CardDescription>Utilisateurs actifs en ce moment</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2 text-sm">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Vérification en cours...
                </div>
              ) : activeUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-200" />
                  <p>Aucun utilisateur connecté récemment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeUsers.map((activeUser) => {
                    const timeDiff = Math.max(0, Math.floor((Date.now() - activeUser.lastActive) / 1000));
                    let relativeTime = "Actif(ve) à l'instant";
                    if (timeDiff >= 60) {
                      relativeTime = `Il y a ${Math.floor(timeDiff / 60)} min`;
                    }

                    return (
                      <div 
                        key={activeUser.email} 
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:shadow-xs hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar Circle */}
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-primary-foreground font-bold flex items-center justify-center text-sm border border-primary/10">
                              <span className="text-slate-800 font-semibold">{getInitials(activeUser.name)}</span>
                            </div>
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="font-bold text-sm text-slate-800">{activeUser.name}</h4>
                            <p className="text-[11px] text-slate-400 font-medium leading-none">{activeUser.email}</p>
                            
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-semibold bg-white text-slate-600 capitalize">
                                {activeUser.role}
                              </Badge>
                              <span className="text-[9px] text-slate-400 truncate max-w-[80px]" title={activeUser.tenant}>
                                {activeUser.tenant}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-100">
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
