import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAppointmentsAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/salle-attente")({
  component: SalleAttentePage,
});

function SalleAttentePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAppts = async () => {
    if (!user?.tenant_id) return;
    try {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const data = await getAppointmentsAction({ data: { date: today, tenantId: user.tenant_id } }) as any[];
      setAppts(data.filter((a: any) => a.status === "waiting"));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAppts();
    const interval = setInterval(loadAppts, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [user?.tenant_id]);

  if (loading || !isAuthenticated) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-display">
      <header className="bg-white shadow-sm px-8 py-6 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-primary">Salle d'Attente</h1>
        <div className="flex items-center gap-2 text-3xl text-slate-600 font-semibold">
          <Clock className="w-8 h-8 text-primary" />
          {format(currentTime, "HH:mm", { locale: fr })}
        </div>
      </header>
      
      <main className="flex-1 p-8 flex flex-col">
        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
            <p className="text-4xl">Aucun patient en attente pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 auto-rows-max">
            {appts.map(appt => (
              <div key={appt.id} className="bg-white rounded-2xl shadow-xl p-8 border-l-8 border-orange-400 animate-in fade-in zoom-in duration-500 flex flex-col justify-center min-h-[220px]">
                <h2 className="text-4xl font-bold text-slate-800 mb-4 truncate" title={appt.client_name}>{appt.client_name}</h2>
                <div className="space-y-2 mt-auto">
                  <p className="text-xl text-slate-500">Heure prévue : <span className="font-semibold text-slate-700">{format(new Date(appt.starts_at), "HH:mm")}</span></p>
                  {appt.service_name && <p className="text-lg text-slate-400 truncate" title={appt.service_name}>{appt.service_name}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <footer className="bg-white px-8 py-4 text-center text-slate-400 text-sm">
        {user?.tenant_name || "Système de Gestion de Rendez-vous"}
      </footer>
    </div>
  );
}
