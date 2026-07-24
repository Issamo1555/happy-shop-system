import { createFileRoute, Link } from "@tanstack/react-router";
import { getPricingOffersAction } from "@/lib/actions";
import { Check, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  loader: async () => {
    const offers = await getPricingOffersAction();
    return { offers };
  },
});

const translations = {
  fr: {
    nav: {
      login: "Connexion Espace Client",
      trial: "Essai Gratuit"
    },
    header: {
      title: "Des tarifs simples, transparents et sans surprise.",
      desc: "Choisissez le plan qui correspond parfaitement à la taille de votre cabinet. Facturation claire, annulation possible à tout moment."
    },
    offer: {
      popular: "Le plus populaire",
      month: "/mois",
      year: "/an",
      btn: "Commencer l'essai gratuit"
    },
    empty: "Les offres sont en cours de configuration. Revenez plus tard."
  },
  ar: {
    nav: {
      login: "تسجيل الدخول",
      trial: "تجربة مجانية"
    },
    header: {
      title: "أسعار بسيطة، شفافة وبدون مفاجآت.",
      desc: "اختر الباقة التي تناسب حجم عيادتك تماماً. فواتير واضحة، وإمكانية الإلغاء في أي وقت."
    },
    offer: {
      popular: "الأكثر شعبية",
      month: "/شهر",
      year: "/سنة",
      btn: "ابدأ التجربة المجانية"
    },
    empty: "يتم إعداد العروض حالياً. يرجى العودة لاحقاً."
  }
};

function PricingPage() {
  const { offers } = Route.useLoaderData();
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const t = translations[lang];

  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const textLeft = isAr ? "text-right" : "text-left";
  const flexItems = isAr ? "flex-row-reverse" : "flex-row";

  return (
    <div dir={dir} className={`min-h-screen bg-slate-50 font-sans selection:bg-primary/20 ${isAr ? 'font-arabic' : ''}`}>
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className={`max-w-7xl mx-auto px-4 h-16 flex items-center justify-between ${flexItems}`}>
          <div className={`flex items-center gap-2 ${flexItems}`}>
            <Link to="/" className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xl hover:opacity-90">S</Link>
            <Link to="/" className="font-display font-bold text-xl tracking-tight text-slate-900">SyncAPOS</Link>
          </div>
          <div className={`flex items-center gap-4 ${flexItems}`}>
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full shadow-sm text-slate-600 border-slate-200"
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
              title="Changer de langue / تغيير اللغة"
            >
              <Globe className="w-4 h-4" />
            </Button>
            <Link to="/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-primary transition-colors">{t.nav.login}</Link>
            <Link to="/login" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm">{t.nav.trial}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-slate-900">
            {t.header.title}
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {t.header.desc}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
          {offers.map((offer: any) => {
            const featuresList = offer.features ? offer.features.split('\n').map((f: string) => f.trim()).filter((f: string) => f.length > 0) : [];
            const isPro = offer.title.toLowerCase().includes('pro') || offer.title.toLowerCase().includes('premium');
            
            return (
              <div 
                key={offer.id} 
                className={`relative flex flex-col p-8 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isPro ? 'ring-2 ring-primary shadow-lg scale-105 z-10' : ''} ${textLeft}`}
              >
                {isPro && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{t.offer.popular}</span>
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{offer.title}</h3>
                  <p className="text-sm text-slate-500 min-h-[40px]">{offer.description}</p>
                </div>
                
                <div className={`mb-8 flex items-baseline text-slate-900 ${flexItems}`}>
                  <span className="text-5xl font-display font-bold tracking-tight">{offer.price}</span>
                  <span className={`text-xl font-semibold ${isAr ? 'mr-2' : 'ml-1'}`}>DH</span>
                  <span className={`text-sm text-slate-500 font-medium ${isAr ? 'mr-1' : 'ml-1'}`}>
                    {offer.billing_cycle === 'monthly' ? t.offer.month : t.offer.year}
                  </span>
                </div>

                <Link 
                  to="/login"
                  className={`mt-auto w-full py-3 px-4 rounded-xl font-semibold text-center transition-all ${isPro ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                >
                  {t.offer.btn}
                </Link>

                <div className="mt-8 space-y-4 pt-8 border-t border-slate-100">
                  {featuresList.map((feat: string, idx: number) => (
                    <div key={idx} className={`flex gap-3 text-sm text-slate-600 ${isAr ? 'flex-row-reverse text-right' : 'flex-row'}`}>
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
              {t.empty}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
