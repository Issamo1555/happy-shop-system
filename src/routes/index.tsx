import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, Activity, Calendar, CreditCard, Users, Shield, Zap, HeartPulse, CheckCircle2, Globe, PlayCircle, CalendarCheck } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
    lead: {
      book_btn: "Demander une démo",
      book_title: "Réserver une présentation gratuite",
      book_desc: "Laissez-nous vos coordonnées. Un expert vous contactera pour une démo personnalisée de 10 min de notre outil.",
      demo_btn: "Tester l'interface",
      demo_title: "Accès immédiat à l'environnement de test",
      demo_desc: "Entrez votre numéro WhatsApp pour accéder directement à la Sandbox (sans mot de passe).",
      phone_placeholder: "Votre numéro WhatsApp (ex: 06...)",
      name_placeholder: "Dr. Nom & Prénom",
      submit_book: "Être rappelé",
      submit_demo: "Accéder maintenant",
      success_book: "C'est noté ! Un conseiller vous contactera très vite.",
      success_demo: "Connexion à l'environnement de test...",
    },
    storyboard: {
      badge: "La transformation SyncAPOS",
      title: "De la paperasse à l'efficacité totale",
      s1_title: "Fini le stress",
      s1_desc: "Oubliez les dossiers perdus et les erreurs de caisse. Retrouvez la sérénité au cabinet.",
      s2_title: "Tout sur tablette",
      s2_desc: "Gérez vos patients, vos séances de kiné d'un simple clic depuis n'importe quel écran.",
      s3_title: "Statistiques en direct",
      s3_desc: "Visualisez votre croissance et votre chiffre d'affaires sur des graphiques clairs."
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
    lead: {
      book_btn: "طلب عرض توضيحي",
      book_title: "حجز عرض تقديمي مجاني",
      book_desc: "اترك لنا معلوماتك. سيتصل بك أحد خبرائنا لتقديم عرض مخصص لمدة 10 دقائق لبرنامجنا.",
      demo_btn: "تجربة البرنامج",
      demo_title: "ولوج فوري إلى بيئة التجربة",
      demo_desc: "أدخل رقم الواتساب الخاص بك للولوج مباشرة (بدون كلمة مرور).",
      phone_placeholder: "رقم الواتساب الخاص بك (مثال: 06...)",
      name_placeholder: "د. الاسم والنسب",
      submit_book: "اتصلوا بي",
      submit_demo: "الولوج الآن",
      success_book: "تم التسجيل! سيتصل بك مستشارنا في أقرب وقت.",
      success_demo: "جاري الاتصال ببيئة التجربة...",
    },
    storyboard: {
      badge: "تحول جذري مع SyncAPOS",
      title: "من الفوضى الورقية إلى الكفاءة التامة",
      s1_title: "نهاية التوتر",
      s1_desc: "انسَ الملفات الضائعة وأخطاء الحسابات. استعد هدوءك في العيادة.",
      s2_title: "كل شيء على الجهاز اللوحي",
      s2_desc: "أدر مرضاك وحصص الترويض الطبي بنقرة واحدة فقط من أي شاشة.",
      s3_title: "إحصائيات مباشرة",
      s3_desc: "تتبع نمو عيادتك وأرباحك من خلال رسوم بيانية واضحة."
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
  const navigate = useNavigate();
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const t = translations[lang];

  // Dir attributes based on language
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const textLeft = isAr ? "text-right" : "text-left";
  const marginArrow = isAr ? "mr-2 rotate-180" : "ml-2";
  const marginIcon = isAr ? "ml-2" : "mr-2";
  const flexItems = isAr ? "flex-row-reverse" : "flex-row";

  const validatePhone = (p: string) => {
    const cleanPhone = p.replace(/[\s-]/g, '');
    // Accepte les numéros marocains (06...) et internationaux (+33..., 00212...) de 8 à 15 chiffres
    const phoneRegex = /^(?:\+|00)?[1-9]\d{6,14}$|^0[1-9]\d{8}$/;
    return phoneRegex.test(cleanPhone);
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error(isAr ? "المرجو إدخال رقم الهاتف" : "Veuillez entrer un numéro de téléphone");
      return;
    }
    if (!validatePhone(phone)) {
      toast.error(isAr ? "رقم الهاتف غير صالح (يجب أن يحتوي على 8 أرقام على الأقل)" : "Numéro de téléphone invalide (au moins 8 chiffres attendus)");
      return;
    }
    // Simulation d'envoi vers un CRM
    toast.success(t.lead.success_book);
    setIsBookModalOpen(false);
    setPhone("");
    setName("");
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error(isAr ? "المرجو إدخال رقم الهاتف" : "Veuillez entrer un numéro de téléphone");
      return;
    }
    if (!validatePhone(phone)) {
      toast.error(isAr ? "رقم الهاتف غير صالح (يجب أن يحتوي على 8 أرقام على الأقل)" : "Numéro de téléphone invalide (au moins 8 chiffres attendus)");
      return;
    }
    // Simulation : Sauvegarde du lead et redirection vers dashboard sandbox
    toast.success(t.lead.success_demo);
    setTimeout(() => {
      navigate({ to: "/login" }); // Ici, on pourrait logguer un user sandbox et aller sur /dashboard
    }, 1500);
  };

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
                <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
                  <DialogTrigger asChild>
                    <Button className={`rounded-full px-6 shadow-sm ${flexItems}`}>
                      {t.nav.start} <ArrowRight className={`w-4 h-4 ${marginArrow}`} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={isAr ? "text-right" : "text-left"}>
                    <DialogHeader>
                      <DialogTitle className="text-2xl">{t.lead.book_title}</DialogTitle>
                      <DialogDescription className="text-base mt-2">
                        {t.lead.book_desc}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBookSubmit} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Input placeholder={t.lead.name_placeholder} value={name} onChange={(e) => setName(e.target.value)} required className={isAr ? "text-right" : "text-left"} />
                      </div>
                      <div className="space-y-2">
                        <Input type="tel" placeholder={t.lead.phone_placeholder} value={phone} onChange={(e) => setPhone(e.target.value)} required className={isAr ? "text-right" : "text-left"} />
                      </div>
                      <Button type="submit" className="w-full h-12 text-base">{t.lead.submit_book}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
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
            {/* BOOK A DEMO (Primary) */}
            <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20">
                  <CalendarCheck className={`w-5 h-5 ${marginIcon}`} /> {t.lead.book_btn}
                </Button>
              </DialogTrigger>
            </Dialog>

            {/* INSTANT SANDBOX DEMO (Secondary) */}
            <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base font-semibold border-slate-300 hover:bg-slate-50">
                  <PlayCircle className={`w-5 h-5 ${marginIcon} text-primary`} /> {t.lead.demo_btn}
                </Button>
              </DialogTrigger>
              <DialogContent className={isAr ? "text-right" : "text-left"}>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{t.lead.demo_title}</DialogTitle>
                  <DialogDescription className="text-base mt-2">
                    {t.lead.demo_desc}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleDemoSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Input type="tel" placeholder={t.lead.phone_placeholder} value={phone} onChange={(e) => setPhone(e.target.value)} required className={isAr ? "text-right" : "text-left"} />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full h-12 text-base font-semibold bg-primary/10 text-primary hover:bg-primary/20">{t.lead.submit_demo}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-4 text-sm text-slate-500">{t.hero.note}</p>

          {/* Abstract Dashboard Preview */}
          <div className="mt-20 max-w-5xl mx-auto bg-white rounded-2xl border shadow-2xl p-2 md:p-4 aspect-video flex items-center justify-center relative group overflow-hidden cursor-pointer" onClick={() => setIsDemoModalOpen(true)}>
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
              <Button size="lg" className="rounded-full shadow-xl pointer-events-none">
                <PlayCircle className={`w-5 h-5 ${marginIcon}`} /> {t.hero.demo}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Storyboard Section (Inspired by visual flow) */}
      <section className="py-24 bg-slate-100 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-primary font-semibold tracking-wide uppercase text-sm mb-3">{t.storyboard.badge}</h2>
            <h3 className="text-3xl md:text-4xl font-display font-bold text-slate-900">{t.storyboard.title}</h3>
          </div>

          <div className="w-full max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-slate-200 group bg-slate-200">
            <img 
              src="/uploads/fliki_banner.png" 
              alt="Transformation SyncAPOS" 
              className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700" 
              onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2000" }}
            />
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
