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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-display text-slate-500">
        Chargement...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-display selection:bg-orange-100 selection:text-orange-900">
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl border border-orange-200">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold font-display text-primary flex items-center gap-3">
              Salle d'Attente
              {appts.length > 0 && (
                <span className="bg-orange-500 text-white text-sm px-3 py-0.5 rounded-full font-bold shadow-sm">
                  {appts.length} {appts.length === 1 ? "personne" : "personnes"}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">Gestion des priorités et ordre de passage</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl shadow-inner">
          <Clock className="w-7 h-7 text-primary animate-pulse" />
          <span className="text-3xl font-bold tracking-tight text-slate-700">
            {format(currentTime, "HH:mm:ss", { locale: fr })}
          </span>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 flex flex-col">
        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-20">
            <div className="w-24 h-24 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-6">
              <Sparkles className="w-12 h-12 text-slate-300" />
            </div>
            <h2 className="text-3xl font-bold text-slate-700 mb-2">Aucun patient en attente pour le moment</h2>
            <p className="text-slate-500 text-lg">La liste d'attente est actuellement vide</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 auto-rows-max">
            {appts.map((appt, index) => {
              const priorityNumber = index + 1;
              const isNext = index === 0;

              return (
                <div
                  key={appt.id}
                  className={`bg-white rounded-2xl shadow-xl p-8 border-l-8 transition-all duration-500 flex flex-col justify-between min-h-[240px] animate-in fade-in zoom-in ${
                    isNext
                      ? "border-orange-500 ring-2 ring-orange-400/40 bg-gradient-to-br from-amber-50/60 to-white"
                      : "border-slate-300"
                  }`}
                >
                  {/* HEADER CARD: BADGE PRIORITÉ */}
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-lg shadow-sm border ${
                        isNext
                          ? "bg-orange-500 text-white border-orange-600 animate-pulse"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <Award className="w-5 h-5" />
                      <span>N° {priorityNumber}</span>
                    </div>

                    {isNext && (
                      <span className="bg-orange-100 text-orange-800 border border-orange-200 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                        PROCHAIN CLIENT
                      </span>
                    )}
                  </div>

                  {/* CLIENT NAME */}
                  <div className="my-2">
                    <h2
                      className="text-4xl font-bold text-slate-800 mb-2 truncate"
                      title={appt.client_name}
                    >
                      {appt.client_name}
                    </h2>
                    {appt.service_name && (
                      <p className="text-lg text-slate-500 truncate" title={appt.service_name}>
                        {appt.service_name}
                      </p>
                    )}
                  </div>

                  {/* FOOTER DETAILS */}
                  <div className="space-y-1 mt-auto pt-4 border-t border-slate-100">
                    <p className="text-xl text-slate-500">
                      Heure prévue :{" "}
                      <span className="font-semibold text-slate-700">
                        {format(new Date(appt.starts_at), "HH:mm")}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white px-8 py-4 border-t border-slate-200 text-center text-slate-500 text-sm flex justify-between items-center">
        <span>{user?.tenant_name || "Système de Gestion de Rendez-vous"}</span>
        <span className="text-xs text-slate-400">Ordre de priorité 1 à N</span>
      </footer>
    </div>
  );
}
