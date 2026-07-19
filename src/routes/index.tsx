import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, Activity, Calendar, CreditCard, Users, Shield, Zap, HeartPulse, CheckCircle2, Globe } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const translations = {
  fr: {
    nav: {
      features: "Fonctionnalités",
      benefits: "Avantages",
      pricing: "Tarifs",
      login: "Se connecter",
      start: "Démarrer",
      dashboard: "Mon Espace"
    },
    hero: {
      badge: "La solution N°1 au Maroc pour les professionnels de santé 🇲🇦",
      title1: "Gérez votre cabinet médical",
      title2: "sans aucun effort.",
      desc: "SyncAPOS rassemble votre Caisse, votre Agenda et vos Dossiers Patients dans une interface ultra-moderne. Conçu pour les médecins et les centres de kinésithérapie.",
      try: "Essayer gratuitement 14 jours",
      offers: "Découvrir nos offres",
      note: "Aucune carte de crédit requise. Installation en 2 minutes.",
      demo: "Accéder à la démo"
    },
    features: {
      badge: "Une solution tout-en-un",
      title: "Tout ce dont votre centre a besoin. Rien de superflu.",
      f1_title: "Caisse & Facturation",
      f1_desc: "Encaissez rapidement, générez des factures normalisées et suivez votre chiffre d'affaires en temps réel.",
      f2_title: "Agenda Intelligent",
      f2_desc: "Prenez des rendez-vous en un clin d'œil. Ne ratez plus aucune consultation grâce à une vue claire de votre journée.",
      f3_title: "Suivi des Packs",
      f3_desc: "Spécialement conçu pour la kinésithérapie : vendez des packs de séances et pointez automatiquement chaque présence."
    },
    benefits: {
      title: "Pourquoi les médecins choisissent SyncAPOS ?",
      b1_title: "Sécurité et Confidentialité",
      b1_desc: "Vos données médicales et financières sont chiffrées et stockées en toute sécurité.",
      b2_title: "Prise en main immédiate",
      b2_desc: "Aucune formation longue requise. L'interface est si intuitive que vos secrétaires seront opérationnels le jour même.",
      b3_title: "Multi-Utilisateurs",
      b3_desc: "Gérez différents accès : Médecins, Secrétaires, Superviseurs, avec des droits stricts.",
      box_title: "Prêt à digitaliser votre centre ?",
      li1: "Assistance technique 7j/7",
      li2: "Mises à jour incluses",
      li3: "Démonstration sur site possible",
      btn: "Consulter les tarifs"
    },
    footer: {
      made_with: "Fait avec ❤️ au Maroc.",
      contact: "Contact",
      legal: "Mentions légales",
      privacy: "Confidentialité"
    }
  },
  ar: {
    nav: {
      features: "المميزات",
      benefits: "الفوائد",
      pricing: "الأسعار",
      login: "تسجيل الدخول",
      start: "ابدأ الآن",
      dashboard: "مساحتي"
    },
    hero: {
      badge: "الحل رقم 1 في المغرب لمهنيي الصحة 🇲🇦",
      title1: "قم بإدارة عيادتك الطبية",
      title2: "بكل سهولة.",
      desc: "يجمع SyncAPOS بين صندوق الأداء، مفكرة المواعيد، وملفات المرضى في واجهة عصرية جداً. مصمم خصيصاً للأطباء ومراكز الترويض الطبي.",
      try: "جرب مجاناً لمدة 14 يوماً",
      offers: "اكتشف عروضنا",
      note: "بدون بطاقة ائتمان. التثبيت في دقيقتين فقط.",
      demo: "الولوج إلى العرض التجريبي"
    },
    features: {
      badge: "حل شامل ومتكامل",
      title: "كل ما يحتاجه مركزك. بدون أي تعقيدات.",
      f1_title: "صندوق الأداء والفواتير",
      f1_desc: "استخلص أموالك بسرعة، أصدر فواتير مطابقة للمعايير وتابع أرباحك في الوقت الفعلي.",
      f2_title: "مفكرة مواعيد ذكية",
      f2_desc: "سجل المواعيد في لمح البصر. لا تفوت أي استشارة بفضل الرؤية الواضحة ليومك.",
      f3_title: "تتبع حصص العلاج (Packs)",
      f3_desc: "مصمم خصيصاً لمراكز الترويض الطبي: قم ببيع باقات الحصص وتسجيل الحضور تلقائياً."
    },
    benefits: {
      title: "لماذا يختار الأطباء SyncAPOS ؟",
      b1_title: "الأمان والسرية",
      b1_desc: "بياناتك الطبية والمالية مشفرة ومحفوظة بأمان تام.",
      b2_title: "استخدام فوري وسهل",
      b2_desc: "لا حاجة لتدريب طويل. الواجهة سهلة جداً بحيث يمكن للكاتبة استخدامها من اليوم الأول.",
      b3_title: "متعدد المستخدمين",
      b3_desc: "إدارة صلاحيات متعددة: أطباء، كتابة، مشرفين، بصلاحيات صارمة.",
      box_title: "مستعد لتطوير مركزك؟",
      li1: "دعم فني طيلة أيام الأسبوع",
      li2: "التحديثات مجانية ومستمرة",
      li3: "إمكانية عرض توضيحي بعين المكان",
      btn: "اطلع على الأسعار"
    },
    footer: {
      made_with: "صنع بـ ❤️ في المغرب.",
      contact: "اتصل بنا",
      legal: "إشعار قانوني",
      privacy: "سياسة الخصوصية"
    }
  }
};

function LandingPage() {
  const { user } = useAuth();
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const t = translations[lang];

  // Dir attributes based on language
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const textLeft = isAr ? "text-right" : "text-left";
  const marginArrow = isAr ? "mr-2 rotate-180" : "ml-2";
  const flexItems = isAr ? "flex-row-reverse" : "flex-row";

  return (
    <div dir={dir} className={`min-h-screen bg-slate-50 selection:bg-primary/20 selection:text-primary ${isAr ? 'font-arabic' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between ${flexItems}`}>
          <div className={`flex items-center gap-2 ${flexItems}`}>
            <div className="bg-primary p-2 rounded-xl text-white shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-xl font-display font-bold text-slate-900 tracking-tight">SyncAPOS</span>
          </div>
          
          <nav className={`hidden md:flex gap-8 ${flexItems}`}>
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">{t.nav.features}</a>
            <a href="#benefits" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">{t.nav.benefits}</a>
            <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">{t.nav.pricing}</Link>
          </nav>

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
            {user ? (
              <Button asChild className={`rounded-full px-6 shadow-sm ${flexItems}`}>
                <Link to="/dashboard">
                  {t.nav.dashboard} <ArrowRight className={`w-4 h-4 ${marginArrow}`} />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:flex text-slate-600">
                  <Link to="/login">{t.nav.login}</Link>
                </Button>
                <Button asChild className={`rounded-full px-6 shadow-sm ${flexItems}`}>
                  <Link to="/login">
                    {t.nav.start} <ArrowRight className={`w-4 h-4 ${marginArrow}`} />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-white to-transparent opacity-60"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-sm font-medium mb-8 border border-blue-100 ${flexItems}`}>
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            {t.hero.badge}
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            {t.hero.title1} <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">{t.hero.title2}</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto font-medium">
            {t.hero.desc}
          </p>
          <div className={`mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center ${flexItems}`}>
            <Button size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20" asChild>
              <Link to="/login">{t.hero.try}</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base font-semibold border-slate-300 hover:bg-slate-50" asChild>
              <Link to="/pricing">{t.hero.offers}</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">{t.hero.note}</p>

          {/* Abstract Dashboard Preview */}
          <div className="mt-20 max-w-5xl mx-auto bg-white rounded-2xl border shadow-2xl p-2 md:p-4 aspect-video flex items-center justify-center relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100"></div>
            {/* Mockup Elements */}
            <div className={`absolute top-4 ${isAr ? 'right-4' : 'left-4'} ${isAr ? 'left-4' : 'right-4'} h-12 bg-white rounded-lg border shadow-sm flex items-center px-4 gap-4 ${flexItems}`}>
              <div className="w-8 h-8 rounded-full bg-slate-200"></div>
              <div className="w-24 h-4 rounded-md bg-slate-200"></div>
              <div className="w-16 h-4 rounded-md bg-slate-200"></div>
            </div>
            <div className={`absolute top-20 ${isAr ? 'right-4' : 'left-4'} bottom-4 w-64 bg-white rounded-lg border shadow-sm p-4 hidden md:flex flex-col gap-3`}>
              <div className="w-full h-8 rounded-md bg-primary/10"></div>
              <div className="w-full h-8 rounded-md bg-slate-100"></div>
              <div className="w-full h-8 rounded-md bg-slate-100"></div>
            </div>
            <div className={`absolute top-20 ${isAr ? 'right-72 left-4' : 'left-72 right-4'} bottom-4 bg-white rounded-lg border shadow-sm p-6 flex flex-col gap-6`}>
              <div className={`w-48 h-6 rounded-md bg-slate-200 ${isAr ? 'self-end' : ''}`}></div>
              <div className={`flex gap-4 ${flexItems}`}>
                <div className="flex-1 h-32 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100"></div>
                <div className="flex-1 h-32 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100"></div>
                <div className="flex-1 h-32 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100"></div>
              </div>
            </div>
            <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-20">
              <Button size="lg" className="rounded-full shadow-xl" asChild>
                <Link to="/login">{t.hero.demo}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-primary font-semibold tracking-wide uppercase text-sm mb-3">{t.features.badge}</h2>
            <h3 className="text-3xl md:text-4xl font-display font-bold text-slate-900">{t.features.title}</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className={`bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1 ${textLeft}`}>
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <CreditCard className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{t.features.f1_title}</h4>
              <p className="text-slate-600 leading-relaxed">
                {t.features.f1_desc}
              </p>
            </div>
            <div className={`bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1 ${textLeft}`}>
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{t.features.f2_title}</h4>
              <p className="text-slate-600 leading-relaxed">
                {t.features.f2_desc}
              </p>
            </div>
            <div className={`bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1 ${textLeft}`}>
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <HeartPulse className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{t.features.f3_title}</h4>
              <p className="text-slate-600 leading-relaxed">
                {t.features.f3_desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Benefits */}
      <section id="benefits" className={`py-24 bg-slate-900 text-white ${textLeft}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid md:grid-cols-2 gap-16 items-center ${isAr ? '[&>*:first-child]:order-last' : ''}`}>
            <div>
              <h3 className="text-3xl md:text-4xl font-display font-bold mb-6">{t.benefits.title}</h3>
              <ul className="space-y-6">
                <li className={`flex gap-4 ${flexItems}`}>
                  <div className="mt-1 bg-white/10 p-2 rounded-lg h-fit"><Shield className="w-5 h-5 text-blue-400"/></div>
                  <div>
                    <h5 className="font-bold text-lg">{t.benefits.b1_title}</h5>
                    <p className="text-slate-400 mt-1">{t.benefits.b1_desc}</p>
                  </div>
                </li>
                <li className={`flex gap-4 ${flexItems}`}>
                  <div className="mt-1 bg-white/10 p-2 rounded-lg h-fit"><Zap className="w-5 h-5 text-yellow-400"/></div>
                  <div>
                    <h5 className="font-bold text-lg">{t.benefits.b2_title}</h5>
                    <p className="text-slate-400 mt-1">{t.benefits.b2_desc}</p>
                  </div>
                </li>
                <li className={`flex gap-4 ${flexItems}`}>
                  <div className="mt-1 bg-white/10 p-2 rounded-lg h-fit"><Users className="w-5 h-5 text-green-400"/></div>
                  <div>
                    <h5 className="font-bold text-lg">{t.benefits.b3_title}</h5>
                    <p className="text-slate-400 mt-1">{t.benefits.b3_desc}</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className={`bg-slate-800 border border-slate-700 p-8 rounded-3xl relative overflow-hidden`}>
              <div className={`absolute top-0 ${isAr ? 'left-0' : 'right-0'} p-4 opacity-10`}><Activity className="w-32 h-32"/></div>
              <h4 className="text-2xl font-bold mb-6 relative z-10">{t.benefits.box_title}</h4>
              <ul className="space-y-4 mb-8 relative z-10">
                <li className={`flex items-center gap-3 text-slate-300 ${flexItems}`}><CheckCircle2 className="w-5 h-5 text-primary"/> {t.benefits.li1}</li>
                <li className={`flex items-center gap-3 text-slate-300 ${flexItems}`}><CheckCircle2 className="w-5 h-5 text-primary"/> {t.benefits.li2}</li>
                <li className={`flex items-center gap-3 text-slate-300 ${flexItems}`}><CheckCircle2 className="w-5 h-5 text-primary"/> {t.benefits.li3}</li>
              </ul>
              <Button size="lg" className="w-full text-lg h-14" asChild>
                <Link to="/pricing">{t.benefits.btn}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`bg-white border-t border-slate-200 py-12 ${textLeft}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6 ${flexItems}`}>
          <div className={`flex items-center gap-2 ${flexItems}`}>
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-slate-900 text-lg">SyncAPOS</span>
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} SyncAPOS. {t.footer.made_with}</p>
          <div className={`flex gap-4 text-sm text-slate-500 ${flexItems}`}>
            <a href="#" className="hover:text-primary">{t.footer.contact}</a>
            <a href="#" className="hover:text-primary">{t.footer.legal}</a>
            <a href="#" className="hover:text-primary">{t.footer.privacy}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
