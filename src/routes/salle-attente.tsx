import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAppointmentsAction } from "@/lib/actions";
import { useAuth } from "@/lib/auth-context";
import { format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, UserCheck, Sparkles, Award } from "lucide-react";

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
      const data = (await getAppointmentsAction({
        data: { date: today, tenantId: user.tenant_id },
      })) as any[];

      // Filter and sort chronologically by starts_at for priority queue
      const waiting = data
        .filter((a: any) => a.status === "waiting")
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

      setAppts(waiting);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAppts();
    const interval = setInterval(loadAppts, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [user?.tenant_id]);

  if (loading || !isAuthenticated)
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-display text-slate-400">
        Chargement de la Salle d'Attente...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-display selection:bg-amber-500 selection:text-slate-900">
      {/* HEADER */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700/60 px-8 py-5 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/20 text-amber-400 p-3 rounded-2xl border border-amber-500/30">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Salle d'Attente
              {appts.length > 0 && (
                <span className="bg-amber-500 text-slate-950 text-sm px-3 py-0.5 rounded-full font-bold">
                  {appts.length} {appts.length === 1 ? "personne" : "personnes"}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">Ordre de passage et priorité de prise en charge</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-700/80 px-5 py-2.5 rounded-2xl shadow-inner">
          <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
          <span className="text-3xl font-mono font-bold tracking-wider text-amber-300">
            {format(currentTime, "HH:mm:ss", { locale: fr })}
          </span>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 flex flex-col">
        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-500 py-20">
            <div className="w-24 h-24 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-6 shadow-inner">
              <Sparkles className="w-12 h-12 text-slate-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-300 mb-2">Aucun client en attente</h2>
            <p className="text-slate-400 text-lg">La file d'attente est actuellement libre</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max">
            {appts.map((appt, index) => {
              const priorityNumber = index + 1;
              const isNext = index === 0;

              return (
                <div
                  key={appt.id}
                  className={`relative rounded-3xl p-6 transition-all duration-500 flex flex-col justify-between min-h-[240px] shadow-2xl border ${
                    isNext
                      ? "bg-gradient-to-br from-amber-950/50 via-slate-800/90 to-amber-900/40 border-amber-500/80 ring-4 ring-amber-500/20 shadow-amber-500/10 scale-[1.02]"
                      : "bg-slate-800/70 border-slate-700/80 hover:border-slate-600"
                  }`}
                >
                  {/* BADGE PRIORITÉ */}
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-lg tracking-wider border shadow-md ${
                        isNext
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/40 animate-pulse"
                          : "bg-slate-700/90 text-slate-300 border-slate-600"
                      }`}
                    >
                      <Award className="w-5 h-5" />
                      <span>N° {priorityNumber}</span>
                    </div>

                    {isNext && (
                      <span className="bg-amber-400/20 border border-amber-400/50 text-amber-300 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        PROCHAIN CLIENT
                      </span>
                    )}
                  </div>

                  {/* CLIENT NAME */}
                  <div className="my-2">
                    <h2
                      className={`text-3xl font-extrabold truncate ${
                        isNext ? "text-amber-100 drop-shadow" : "text-white"
                      }`}
                      title={appt.client_name}
                    >
                      {appt.client_name}
                    </h2>
                    {appt.service_name && (
                      <p className="text-base text-slate-300 mt-1 font-medium truncate" title={appt.service_name}>
                        💆 {appt.service_name}
                      </p>
                    )}
                  </div>

                  {/* FOOTER DETAILS */}
                  <div className="pt-4 mt-auto border-t border-slate-700/60 flex justify-between items-center text-sm text-slate-400">
                    <div>
                      <span>Heure prévue : </span>
                      <strong className="text-slate-200 font-mono text-base">
                        {format(new Date(appt.starts_at), "HH:mm")}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950/80 border-t border-slate-800 px-8 py-4 text-center text-slate-500 text-sm flex justify-between items-center">
        <span>{user?.tenant_name || "Système de Gestion de Rendez-vous"}</span>
        <span className="text-xs text-slate-600">Mise à jour en temps réel (Priorités 1 à N)</span>
      </footer>
    </div>
  );
}
