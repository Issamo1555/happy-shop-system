import { createFileRoute, Link } from "@tanstack/react-router";
import { getPricingOffersAction } from "@/lib/actions";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  loader: async () => {
    const offers = await getPricingOffersAction();
    return { offers };
  },
});

function PricingPage() {
  const { offers } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary/20">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xl">S</div>
            <span className="font-display font-bold text-xl tracking-tight text-slate-900">SyncAPOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">Connexion Espace Client</Link>
            <Link to="/login" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm">Essai Gratuit</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-slate-900">
            Des tarifs simples, transparents et sans surprise.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Choisissez le plan qui correspond parfaitement à la taille de votre cabinet. Facturation claire, annulation possible à tout moment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
          {offers.map((offer: any) => {
            const featuresList = offer.features ? offer.features.split('\n').map((f: string) => f.trim()).filter((f: string) => f.length > 0) : [];
            const isPro = offer.title.toLowerCase().includes('pro') || offer.title.toLowerCase().includes('premium');
            
            return (
              <div 
                key={offer.id} 
                className={`relative flex flex-col p-8 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isPro ? 'ring-2 ring-primary shadow-lg scale-105 z-10' : ''}`}
              >
                {isPro && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Le plus populaire</span>
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{offer.title}</h3>
                  <p className="text-sm text-slate-500 h-10">{offer.description}</p>
                </div>
                
                <div className="mb-8 flex items-baseline text-slate-900">
                  <span className="text-5xl font-display font-bold tracking-tight">{offer.price}</span>
                  <span className="text-xl font-semibold">DH</span>
                  <span className="text-sm text-slate-500 ml-1 font-medium">/{offer.billing_cycle === 'monthly' ? 'mois' : 'an'}</span>
                </div>

                <Link 
                  to="/login"
                  className={`mt-auto w-full py-3 px-4 rounded-xl font-semibold text-center transition-all ${isPro ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                >
                  Commencer l'essai gratuit
                </Link>

                <div className="mt-8 space-y-4 pt-8 border-t border-slate-100">
                  {featuresList.map((feat: string, idx: number) => (
                    <div key={idx} className="flex gap-3 text-sm text-slate-600">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {offers.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500">
              Les offres sont en cours de configuration. Revenez plus tard.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
