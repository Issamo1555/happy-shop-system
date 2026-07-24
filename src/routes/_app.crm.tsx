import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getProspectsAction, updateProspectStatusAction, assignProspectAction, getSalesAgentsAction, updateProspectAction, importProspectsAction, distributeProspectsAction, claimNextProspectAction, claimProspectAction, recycleProspectsAction } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MapPin, Building2, UserPlus, PhoneCall, MessageSquareText, Search, Filter, Copy, ArrowDown, AlertCircle, Calendar, Users, Shield, Sparkles, Upload, FileSpreadsheet, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

const scriptNodes: Record<string, {
  title: string;
  badge: string;
  textFr: string;
  textAr: string;
  options: {
    labelFr: string;
    labelAr: string;
    nextNodeId: string;
    type?: 'primary' | 'destructive' | 'outline' | 'success' | 'warning';
  }[];
}> = {
  start: {
    title: "Étape 1 : Briser la glace",
    badge: "Introduction / كسر الجليد",
    textFr: '"Bonjour Docteur/Doctoresse, [Votre Nom] de POSetRDV. Avez-vous une minute ou êtes-vous avec un patient ?"',
    textAr: '"السلام عليكم دكتور/دكتورة، معاك [اسمك] من منصة POSetRDV. واش عندكم دقيقة أو راكم مع شي مريض؟"',
    options: [
      { labelFr: "✅ Disponible (Oui, je vous écoute)", labelAr: "✅ متاح (نعم، كنسمعك)", nextNodeId: "discovery", type: "success" },
      { labelFr: "❌ Occupé (Je suis en consultation)", labelAr: "❌ مشغول (أنا في حصة/مع مريض)", nextNodeId: "busy", type: "destructive" }
    ]
  },
  busy: {
    title: "Rappel ultérieur / rappel programmé",
    badge: "Rappel / تحديد وقت آخر",
    textFr: '"Pas de problème Docteur, je comprends tout à fait. Quel est le meilleur moment pour vous rappeler sans vous déranger ?"',
    textAr: '"ماشي مشكل دكتور، متفهم جداً. فوقاش نقدر نعاود نتصل بيكم بلا ما نزعجكم؟"',
    options: [
      { labelFr: "📅 Proposer un rappel (Date & Heure)", labelAr: "📅 اقتراح وقت محدد للاتصال", nextNodeId: "schedule_callback", type: "primary" },
      { labelFr: "💬 Envoyer WhatsApp & raccrocher", labelAr: "💬 إرسال واتساب وإنهاء الاتصال", nextNodeId: "whatsapp_send", type: "outline" }
    ]
  },
  schedule_callback: {
    title: "Rappel sur l'agenda",
    badge: "Agenda / جدولة",
    textFr: '"C\'est noté Docteur. Je planifie notre rappel pour ce moment-là. Je vous envoie également un petit message de confirmation sur WhatsApp. Très bonne journée !"',
    textAr: '"سجلت عندي دكتور. غنتصل بيك فهاد الوقت إن شاء الله وصيفت ليك تأكيد فالواتساب. يومك سعيد!"',
    options: [
      { labelFr: "🔄 Recommencer la simulation", labelAr: "🔄 إعادة بدء المحاكاة", nextNodeId: "start", type: "outline" }
    ]
  },
  whatsapp_send: {
    title: "Envoi WhatsApp de brochure",
    badge: "WhatsApp / كتيب",
    textFr: '"Parfait Docteur. Je vous envoie notre brochure sur WhatsApp immédiatement pour que vous puissiez la lire à tête reposée. Excellente journée !"',
    textAr: '"ماشي مشكل دكتور. غنصيفت ليك الكتيب ديالنا فالواتساب دابا باش تشوفو على خاطرك. يومك سعيد!"',
    options: [
      { labelFr: "🔄 Recommencer la simulation", labelAr: "🔄 إعادة بدء المحاكاة", nextNodeId: "start", type: "outline" }
    ]
  },
  discovery: {
    title: "Étape 2 : Découverte du besoin",
    badge: "Investigation / اكتشاف المشاكل",
    textFr: '"Comment gérez-vous vos rendez-vous et votre caisse aujourd\'hui ? Vous utilisez plutôt le papier ou un logiciel ?"',
    textAr: '"كيفاش كتسيروا المواعيد والصندوق ديالكم اليوم؟ واش خدامين بالورق أو عندكم شي برنامج؟"',
    options: [
      { labelFr: "📝 J'utilise du papier (cahier)", labelAr: "📝 كنخدم بالورق (الكناش)", nextNodeId: "objection_paper", type: "warning" },
      { labelFr: "💻 J'utilise Dabadoc", labelAr: "💻 كنخدم بـ Dabadoc", nextNodeId: "objection_dabadoc", type: "warning" },
      { labelFr: "💻 J'ai un autre logiciel", labelAr: "💻 عندي برنامج آخر", nextNodeId: "objection_software", type: "warning" },
      { labelFr: "⏳ Je n'ai pas le temps", labelAr: "⏳ ما عنديش الوقت لهاد الأسئلة", nextNodeId: "objection_no_time", type: "destructive" },
      { labelFr: "🗣️ Répond librement (Intéressé)", labelAr: "🗣️ كيجاوب عادي (مهتم)", nextNodeId: "pitch", type: "success" }
    ]
  },
  objection_paper: {
    title: "Objection : Le papier marche très bien",
    badge: "Objection Papier / اعتراض الورق",
    textFr: '"Je comprends Docteur, le papier a fait ses preuves. Mais que se passe-t-il si un cahier est égaré ou si la secrétaire oublie de noter un RDV ? POSetRDV sécurise tout, évite 40% des absences grâce aux rappels WhatsApp et simplifie la caisse. Regardons cela ensemble ?"',
    textAr: '"أكيد دكتور، الورق مجرب. ولكن شنو يوقع إلى ضاع الكناش أو الكاتبة نسات ما سجلاتش موعد؟ برنامجنا يؤمن كل شيء، ينقص 40% من الغيابات بالواتساب ويسهل الصندوق. نشوفو هادشي معاً؟"',
    options: [
      { labelFr: "💡 Comment ça marche ?", labelAr: "💡 كيفاش كيخدم؟", nextNodeId: "pitch", type: "success" },
      { labelFr: "💰 C'est trop cher pour un simple agenda", labelAr: "💰 هادشي غالي بزاف على أجندة", nextNodeId: "objection_price", type: "destructive" }
    ]
  },
  objection_dabadoc: {
    title: "Objection : J'utilise Dabadoc",
    badge: "Dabadoc vs. POSetRDV",
    textFr: '"Dabadoc est un très bon annuaire de visibilité Docteur. Cependant, il s\'arrête à la réservation. POSetRDV est la seule solution 2-en-1 qui intègre la gestion financière complète du cabinet (Caisse tactile, impression de reçus, Z-reports journaliers) et le suivi comptable des Mutuelles. De plus, vos patients restent chez vous sur un portail privé à votre marque, sans vous lister au milieu de tous vos confrères concurrents. Regardons la différence ?"',
    textAr: '"دابادوك دليل زوين باش يبان الاسم ديالكم دكتور، ولكن كيحبس تما. POSetRDV هو البرنامج الوحيد 2 في 1 لي كيدير تسيير الصندوق المالي تاتش، طبع وصولات الأداء، تقارير الحسابات، وتتبع تعويضات التغطية الصحية (الكنوبس والضمان الاجتماعي)، وكيعطيك صفحة خاصة بالعيادة ديالك بلا ما يحطك حدا المنافسين. نشوفو هاد الفرق؟"',
    options: [
      { labelFr: "🔍 D'accord pour voir la démo", labelAr: "🔍 موافق نشوف الديمو", nextNodeId: "close", type: "success" },
      { labelFr: "💰 Quel est le tarif de POSetRDV ?", labelAr: "💰 شحال هو ثمن POSetRDV ؟", nextNodeId: "objection_price", type: "warning" },
      { labelFr: "🛑 Non, Dabadoc me suffit", labelAr: "🛑 لا، دابادوك كافيني", nextNodeId: "refusal", type: "destructive" }
    ]
  },
  objection_software: {
    title: "Objection : J'ai un autre logiciel",
    badge: "Objection Logiciel / اعتراض برنامج",
    textFr: '"C\'est excellent ! Cela montre que vous aimez moderniser. Est-il tactile et gère-t-il votre caisse ET votre agenda sans bug ? Accordez-moi juste 10 minutes de démo pour voir la différence de fluidité de POSetRDV."',
    textAr: '"ممتاز دكتور! هذا كيدل على أنكم كتواكبوا التطور. واش هاد البرنامج تاتش وكيجمع الصندوق والمواعيد بجوج بلا مشاكل؟ عطيني 10 دقائق ديمو وتشوف الفرق الشاسع."',
    options: [
      { labelFr: "🔍 D'accord pour voir la démo", labelAr: "🔍 موافق نشوف الديمو", nextNodeId: "close", type: "success" },
      { labelFr: "👍 Je suis déjà très satisfait du mien", labelAr: "👍 أنا راضي بزاف على ديالي", nextNodeId: "objection_satisfied", type: "warning" }
    ]
  },
  objection_satisfied: {
    title: "Objection : Je suis satisfait",
    badge: "Objection Satisfait / راضي جداً",
    textFr: '"C\'est parfait ! Les cabinets satisfaits adorent généralement notre système de relance WhatsApp automatique qui réduit les absences de 40% et notre caisse tactile marocaine. Regardons cela en 5 minutes ?"',
    textAr: '"رائع دكتور! العيادات اللي مجهزة وراضية كتعجبها بزاف ميزة التذكير التلقائي بالواتساب اللي كتقلص الغيابات بـ 40% والصندوق التاتش. نشوفوها فـ 5 دقائق؟"',
    options: [
      { labelFr: "📅 Ok pour 5 minutes", labelAr: "📅 موافق لـ 5 دقائق", nextNodeId: "close", type: "success" },
      { labelFr: "🛑 Non, pas intéressé du tout", labelAr: "🛑 لا، غير مهتم نهائياً", nextNodeId: "refusal", type: "destructive" }
    ]
  },
  objection_no_time: {
    title: "Objection : Je n'ai pas le temps",
    badge: "Objection Temps / ليس لدي وقت",
    textFr: '"Je comprends tout à fait. Mon but est justement de vous faire gagner du temps. La démo en ligne dure seulement 10 minutes. Quel jour vous arrange la semaine prochaine ?"',
    textAr: '"متفهم جداً دكتور. هدفي هو نوفر وقتكم بالذات. الديمو كتاخذ 10 دقائق فقط. أي نهار يناسبكم السيمانة الجاية؟"',
    options: [
      { labelFr: "📆 Ok pour la semaine prochaine", labelAr: "📆 موافق للأسبوع المقبل", nextNodeId: "close", type: "success" },
      { labelFr: "📧 Envoyez-moi un mail d'abord", labelAr: "📧 صيفت ليا إيميل أولاً", nextNodeId: "objection_email", type: "warning" }
    ]
  },
  objection_email: {
    title: "Objection : Envoyez un mail d'abord",
    badge: "Objection Email / إرسال إيميل",
    textFr: '"Avec plaisir Docteur ! Je vous envoie la brochure. Mais un mail ne montre pas la simplicité tactile. Prenons 5 minutes en ligne juste après pour survoler les fonctionnalités ?"',
    textAr: '"بكل سرور دكتور! غنصيفت ليك الكتيب دابا. ولكن الإيميل ما كيوريش سلاسة النظام. ناخدو 5 دقائق سريعة موراها؟"',
    options: [
      { labelFr: "🤝 D'accord pour un point rapide", labelAr: "🤝 موافق لنقاط سريعة", nextNodeId: "close", type: "success" },
      { labelFr: "📧 Non, juste le mail pour l'instant", labelAr: "📧 لا، غير الإيميل حالياً", nextNodeId: "email_only", type: "outline" }
    ]
  },
  email_only: {
    title: "Envoi de l'e-mail",
    badge: "Email / إرسال",
    textFr: '"C\'est noté Docteur. Je vous envoie l\'e-mail avec la brochure immédiatement. Je vous souhaite une excellente journée !"',
    textAr: '"سجلت دكتور. غنصيفت ليك الإيميل مع الكتيب دابا. يومك سعيد!"',
    options: [
      { labelFr: "🔄 Recommencer la simulation", labelAr: "🔄 إعادة بدء المحاكاة", nextNodeId: "start", type: "outline" }
    ]
  },
  objection_price: {
    title: "Objection : C'est trop cher",
    badge: "Objection Prix / السعر مرتفع",
    textFr: '"Je comprends Docteur. Mais faisons un calcul simple : DabaDoc vous facture environ 500 DH/mois uniquement pour un calendrier. Pour le même prix, POSetRDV vous offre l\'agenda, les rappels WhatsApp ET une caisse tactile complète pour sécuriser vos recettes et suivre vos mutuelles. En évitant juste 2 rendez-vous ratés par mois, l\'outil est 100% autofinancé. Regardons ?"',
    textAr: '"متفهم دكتور. ولكن نديرو حساب بسيط : دابادوك كيقام بـ 500 درهم فالشهر غير على قبل أجندة فالاتصال. بنفس الثمن، POSetRDV كيعطيك الأجندة، تذكير الواتساب، وصندوق مالي تاتش كامل باش تأمن المداخيل وتتبع تعويضات التغطية الصحية. يلا تفادينا غير 2 غيابات فالشهر، الاشتراك كيدفع راسو براسو. نشوفوه؟"',
    options: [
      { labelFr: "💡 Montrez-moi comment", labelAr: "💡 وريني كيفاش؟", nextNodeId: "pitch", type: "success" },
      { labelFr: "🛑 Non merci", labelAr: "🛑 لا شكراً", nextNodeId: "refusal", type: "destructive" }
    ]
  },
  pitch: {
    title: "Étape 3 : Présentation de la valeur",
    badge: "Présentation / تقديم الحل",
    textFr: '"C\'est pour cela qu\'on a créé POSetRDV. C\'est la seule solution marocaine 2-en-1 qui combine un agenda médical avec caisse intégrée. Elle permet de réduire les rendez-vous ratés de 40% grâce aux rappels WhatsApp automatiques, tout en simplifiant la comptabilité de votre secrétaire. Regardons cela ensemble ?"',
    textAr: '"لهذا السبب أنشأنا POSetRDV. هادي هي المنصة المغربية الوحيدة 2 في 1 لي كتجمع بين الأجندة الطبية والصندوق الذكي. كتنقص من المواعيد المنسية بـ 40% عبر تذكير الواتساب التلقائي، وكتسهل الحسابات على الكاتبة ديالكم. نشوفوه معاً؟"',
    options: [
      { labelFr: "📅 Proposer un créneau de Démo (Closer)", labelAr: "📅 اقتراح موعد ديمو (إغلاق)", nextNodeId: "close", type: "success" },
      { labelFr: "👨‍⚕️ Je dois d'abord voir avec mon associé", labelAr: "👨‍⚕️ خاصني نشوف مع الشريك ديالي أولاً", nextNodeId: "objection_partner", type: "warning" }
    ]
  },
  objection_partner: {
    title: "Objection : Voir avec l'associé",
    badge: "Associé / الشريك",
    textFr: '"Parfait ! Faisons la démo de 10 minutes avec lui également. Ce sera plus efficace pour prendre une décision ensemble. Quel jour êtes-vous disponibles tous les deux ?"',
    textAr: '"ممتاز دكتور! فهاد الحالة، نديرو الديمو معاه حتى هو. غيكون هادشي فعال كتر باش تاخدو القرار معاً. أي نهار يناسبكم بجوج؟"',
    options: [
      { labelFr: "📅 Proposer un créneau commun", labelAr: "📅 اقتراح موعد مشترك", nextNodeId: "close", type: "success" }
    ]
  },
  close: {
    title: "Étape 4 : Conclusion / Prise de RDV",
    badge: "Closer / أخذ موعد",
    textFr: '"Mon but n\'est pas de vous vendre quoi que ce soit par téléphone, mais de vous montrer l\'outil en 10 minutes en ligne. Est-ce que demain à [Heure] ou vendredi vous conviendrait ?"',
    textAr: '"هدفي ماشي نبيع ليك شي حاجة فالتلفون، بل نوريكم البرنامج فـ 10 دقائق أونلاين. واش غداً مع [الساعة] أو الجمعة يناسبكم؟"',
    options: [
      { labelFr: "🎉 LE CLIENT ACCEPTE LE RDV !", labelAr: "🎉 العميل يوافق على الموعد !", nextNodeId: "success_rdv", type: "success" },
      { labelFr: "🛑 Refus final", labelAr: "🛑 رفض نهائي", nextNodeId: "refusal", type: "destructive" }
    ]
  },
  success_rdv: {
    title: "Félicitations ! RDV Gagné !",
    badge: "Succès / نجاح 🎉",
    textFr: '"Génial Docteur ! Je note notre rendez-vous. Vous allez recevoir une confirmation par WhatsApp et SMS. Merci pour votre confiance et à très vite !"',
    textAr: '"رائع دكتور! سجلت الموعد ديالنا. غتوصل بتأكيد فالواتساب وميساج. شكراً على الثقة ديالكم وتلاقاو قريب إن شاء الله!"',
    options: [
      { labelFr: "🔄 Recommencer (Nouveau prospect)", labelAr: "🔄 إعادة بدء (مكالمة جديدة)", nextNodeId: "start", type: "primary" }
    ]
  },
  refusal: {
    title: "Fin d'appel (Refus)",
    badge: "Refus / رفض 🛑",
    textFr: '"Je comprends tout à fait Docteur. Je vous remercie pour votre temps et vous souhaite une excellente continuation dans votre cabinet. Au revoir."',
    textAr: '"متفهم جداً دكتور. كنشكركم على الوقت ديالكم وكنتمنى ليكم مسيرة موفقة فالعيادة ديالكم. مع السلامة."',
    options: [
      { labelFr: "🔄 Recommencer (Nouveau prospect)", labelAr: "🔄 إعادة بدء (مكالمة جديدة)", nextNodeId: "start", type: "outline" }
    ]
  }
};

const whatsappTemplates = {
  fr: {
    intro: (prospectName: string, cityName: string, agentName: string) => 
      `Bonjour Dr. ${prospectName}, je suis ${agentName} de la plateforme POSetRDV. Nous aidons les cabinets médicaux de ${cityName || 'votre ville'} à réduire de 40% les rendez-vous non honorés et à simplifier la prise de RDV pour vos patients. Je vous appelle d'ici 10 minutes pour vous présenter brièvement comment adapter cela à votre cabinet. À tout de suite !`,
    missed: (prospectName: string, cityName: string, agentName: string) => 
      `Bonjour Dr. ${prospectName}, j'ai tenté de vous joindre à l'instant. Je sais que votre emploi du temps est très chargé. Je retenterai de vous appeler plus tard. Si vous préférez, vous pouvez me proposer un créneau de 2 minutes pour échanger par retour de message. Bonne journée ! ${agentName} - POSetRDV.`,
    confirm: (prospectName: string, cityName: string, agentName: string, dateStr: string, hourStr: string) => 
      `Bonjour Dr. ${prospectName}, merci pour notre échange. Je vous confirme notre rendez-vous le ${dateStr} à ${hourStr} pour une démonstration rapide (10 minutes) de la plateforme POSetRDV. Un rappel automatique vous sera envoyé. Bonne journée ! ${agentName} - POSetRDV.`
  },
  ar: {
    intro: (prospectName: string, cityName: string, agentName: string) => 
      `السلام عليكم دكتور ${prospectName}، معاك ${agentName} من منصة POSetRDV. تواصلت معاك حيت كنساعدو العيادات الطبية ف ${cityName || 'مدينتكم'} باش ينقصو من المواعيد الملغية ويسهلو حجز المواعيد للمرضى. غادي نتصل بك من هنا 10 دقيق باش نشرح لك باختصار كيفاش نقدروا نساعدو عيادتكم. شكرا !`,
    missed: (prospectName: string, cityName: string, agentName: string) => 
      `السلام عليكم دكتور ${prospectName}، حاولت نتصل بك دابا. عارف وقتك عامر بزااف، غادي نعاود نتصل بك من بعد. إلا كان ممكن، تقدر تقترح عليا شي وقت ديال 2 دقائق فين نقدرو نهضرو فيه. يوم سعيد ! ${agentName} - POSetRDV.`,
    confirm: (prospectName: string, cityName: string, agentName: string, dateStr: string, hourStr: string) => 
      `السلام عليكم دكتور ${prospectName}، شكرا على وقتك وعلى النقاش ديالنا. كنأكد لك الموعد ديالنا يوم ${dateStr} مع ${hourStr} باش نديرو عرض سريع (10 دقيق) لمنصة POSetRDV. غادي يوصلك تذكير تلقائي. يوم سعيد ! ${agentName} - POSetRDV.`
  }
};

export const Route = createFileRoute("/_app/crm")({
  component: CRMPage,
});

interface Prospect {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  specialty: string;
  status: string;
  assigned_to: string | null;
  notes: string;
  callback_at?: string | null;
}

interface Agent {
  id: string;
  name: string;
}

function CRMPage() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  // Edit notes/email state
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("nouveau");
  const [editCallbackAt, setEditCallbackAt] = useState("");
  const [editRdvAt, setEditRdvAt] = useState("");
  const [hasCallback, setHasCallback] = useState(false);
  const [hasRdv, setHasRdv] = useState(false);
  const [savingProspect, setSavingProspect] = useState(false);
  
  // Simulator State
  const [currentNodeId, setCurrentNodeId] = useState("start");
  const [simLang, setSimLang] = useState<"fr" | "ar">("fr");

  // Import States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'allow'>('skip');
  const [duplicateCriteria, setDuplicateCriteria] = useState<'phone_or_email' | 'phone' | 'email'>('phone_or_email');
  
  // Recycling States
  const [isRecycleOpen, setIsRecycleOpen] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(7);
  const [refusalRecycleDays, setRefusalRecycleDays] = useState(15);
  const [recycling, setRecycling] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    name: "",
    phone: "",
    email: "",
    city: "",
    specialty: "",
    notes: ""
  });
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [importResult, setImportResult] = useState<{ inserted: number, updated: number, skipped: number } | null>(null);

  // Dynamic CDN Loader for SheetJS (XLSX)
  const loadXLSX = () => {
    return new Promise<any>((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImporting(true);

    try {
      const XLSX = await loadXLSX();
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (data.length === 0) {
            toast.error("Le fichier sélectionné est vide.");
            setImporting(false);
            return;
          }

          const headers = data[0].map(h => String(h || '').trim()).filter(Boolean);
          const rows = data.slice(1).map(row => {
            const obj: Record<string, any> = {};
            data[0].forEach((header, index) => {
              if (header) {
                obj[String(header).trim()] = row[index] !== undefined ? String(row[index]).trim() : '';
              }
            });
            return obj;
          });

          setImportHeaders(headers);
          setImportRows(rows);
          
          // Column intelligent auto-mapping
          const newMapping: Record<string, string> = {};
          const fields = ['name', 'phone', 'email', 'city', 'specialty', 'notes'];
          const fieldNamesFr: Record<string, string[]> = {
            name: ['nom', 'name', 'client', 'prospect', 'docteur', 'dr'],
            phone: ['telephone', 'phone', 'tel', 'gsm', 'mobile'],
            email: ['email', 'mail', 'courriel'],
            city: ['ville', 'city', 'adresse'],
            specialty: ['specialite', 'speciality', 'domaine', 'profession'],
            notes: ['note', 'notes', 'remarque', 'remarques', 'commentaire', 'commentaires']
          };

          fields.forEach(field => {
            const matchingHeader = headers.find(h => {
              const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return fieldNamesFr[field].some(syn => lower.includes(syn));
            });
            newMapping[field] = matchingHeader || "";
          });

          setColumnMapping(newMapping);
          setImportStep(2);
        } catch (err) {
          console.error(err);
          toast.error("Erreur lors de la lecture du fichier.");
        } finally {
          setImporting(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger la bibliothèque d'importation SheetJS.");
      setImporting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!columnMapping.name) {
      toast.error("La colonne 'Nom' est obligatoire.");
      return;
    }

    setImporting(true);

    try {
      const mappedProspects = importRows.map(row => ({
        name: row[columnMapping.name] || '',
        phone: columnMapping.phone ? row[columnMapping.phone] || '' : '',
        email: columnMapping.email ? row[columnMapping.email] || '' : '',
        city: columnMapping.city ? row[columnMapping.city] || '' : '',
        specialty: columnMapping.specialty ? row[columnMapping.specialty] || '' : '',
        notes: columnMapping.notes ? row[columnMapping.notes] || '' : '',
      })).filter(p => p.name.trim() !== '');

      const result = await importProspectsAction({
        data: {
          userId: user.id,
          prospects: mappedProspects,
          duplicateStrategy,
          duplicateCriteria
        }
      });

      setImportResult(result);
      setImportStep(4);
      toast.success(`Importation réussie : ${result.inserted} nouveaux prospects, ${result.updated} mis à jour, ${result.skipped} ignorés.`);
      fetchCRMData();
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue lors de l'importation.");
    } finally {
      setImporting(false);
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportHeaders([]);
    setImportRows([]);
    setDuplicateStrategy('skip');
    setDuplicateCriteria('phone_or_email');
    setColumnMapping({
      name: "",
      phone: "",
      email: "",
      city: "",
      specialty: "",
      notes: ""
    });
    setImportStep(1);
    setImportResult(null);
    setIsImportOpen(false);
  };

  const [distributing, setDistributing] = useState(false);
  
  const handleDistributeProspects = async () => {
    setDistributing(true);
    try {
      const result = await distributeProspectsAction({ data: { userId: user.id } });
      toast.success(result.message);
      fetchCRMData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la distribution.");
    } finally {
      setDistributing(false);
    }
  };

  const handleClaimNextProspect = async () => {
    setLoading(true);
    try {
      const result = await claimNextProspectAction({ data: { userId: user.id } });
      if (result.success && result.prospectId) {
        toast.success(`Cible attribuée : ${result.name}`);
        const freshProspects = await getProspectsAction({ data: { userId: user.id } });
        setProspects(freshProspects);
        
        const claimed = freshProspects.find(p => p.id === result.prospectId);
        if (claimed) {
          setEditingProspect(claimed);
          setEditEmail(claimed.email || "");
          setEditNotes(claimed.notes || "");
          setEditStatus(claimed.status || "nouveau");
          setEditCallbackAt(claimed.callback_at || "");
          setHasCallback(!!claimed.callback_at);
          setEditRdvAt("");
          setHasRdv(false);
        }
      } else {
        toast.info(result.message || "Aucune cible disponible.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la pioche.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimProspect = async (prospectId: string) => {
    try {
      const result = await claimProspectAction({ data: { userId: user.id, prospectId } });
      toast.success(`Vous vous êtes assigné la cible : ${result.name}`);
      fetchCRMData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'assignation.");
    }
  };

  const handleRecycleProspects = async () => {
    setRecycling(true);
    try {
      const result = await recycleProspectsAction({
        data: {
          userId: user.id,
          inactivityDays,
          refusalRecycleDays
        }
      });
      toast.success(`${result.count} fiches froides recyclées et remises en circulation !`);
      setIsRecycleOpen(false);
      fetchCRMData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du recyclage.");
    } finally {
      setRecycling(false);
    }
  };

  const fetchCRMData = async () => {
    try {
      const p = await getProspectsAction({ data: { userId: user.id } });
      setProspects(p);
      
      if (user.role === 'super_admin') {
        const a = await getSalesAgentsAction({ data: { userId: user.id } });
        setAgents(a);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement du CRM");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
  }, [user.id, user.role]);

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    const p = prospects.find(x => x.id === prospectId);
    if (!p) return;

    if (newStatus === "rappel") {
      setEditingProspect(p);
      setEditEmail(p.email || "");
      setEditNotes(p.notes || "");
      setEditStatus(newStatus);
      setEditCallbackAt(p.callback_at || "");
      setHasCallback(true);
      setEditRdvAt("");
      setHasRdv(false);
    } else if (newStatus === "intéressé") {
      setEditingProspect(p);
      setEditEmail(p.email || "");
      setEditNotes(p.notes || "");
      setEditStatus(newStatus);
      setEditCallbackAt(p.callback_at || "");
      setHasCallback(false);
      setEditRdvAt("");
      setHasRdv(true);
    } else {
      try {
        await updateProspectStatusAction({ data: { userId: user.id, prospectId, status: newStatus } });
        toast.success("Statut mis à jour !");
        fetchCRMData();
      } catch (err: any) {
        toast.error("Erreur: " + err.message);
      }
    }
  };

  const handleAssignChange = async (prospectId: string, assignedTo: string) => {
    try {
      await assignProspectAction({ data: { userId: user.id, prospectId, assignedTo: assignedTo === 'none' ? null : assignedTo } });
      toast.success("Prospect assigné !");
      fetchCRMData();
    } catch (err: any) {
      toast.error("Erreur d'assignation: " + err.message);
    }
  };

  const handleSaveProspect = async () => {
    if (!editingProspect) return;
    setSavingProspect(true);
    try {
      await updateProspectAction({
        data: {
          userId: user.id,
          prospectId: editingProspect.id,
          email: editEmail,
          notes: editNotes,
          status: editStatus,
          callbackAt: hasCallback ? (editCallbackAt || null) : null,
          rdvAt: hasRdv ? (editRdvAt || null) : null,
        }
      });
      toast.success("Prospect mis à jour !");
      setEditingProspect(null);
      fetchCRMData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingProspect(false);
    }
  };

  const handleNotesChangeLocal = (prospectId: string, value: string) => {
    setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, notes: value } : p));
  };

  const handleNotesBlur = async (prospectId: string) => {
    const p = prospects.find(x => x.id === prospectId);
    if (!p) return;
    try {
      await updateProspectAction({
        data: {
          userId: user.id,
          prospectId: p.id,
          email: p.email || "",
          notes: p.notes || "",
          status: p.status,
          callbackAt: p.callback_at || null,
          rdvAt: null,
        }
      });
      toast.success("Notes sauvegardées !");
    } catch (err: any) {
      toast.error("Erreur de sauvegarde: " + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nouveau': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'recyclé': return 'bg-teal-50 text-teal-700 border border-teal-200';
      case 'sans_reponse': return 'bg-slate-50 text-slate-600 border border-slate-200';
      case 'contacte': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'rappel': return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'pas_interesse': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'refus_definitif': return 'bg-rose-100 text-rose-800 border border-rose-200 font-bold';
      case 'intéressé': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'client': return 'bg-green-50 text-green-700 border border-green-200';
      case 'refus': return 'bg-red-50 text-red-700 border border-red-200';
      case 'contacté': return 'bg-slate-50 text-slate-700 border border-slate-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const isCallbackOverdue = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      return date.getTime() < now.getTime();
    } catch {
      return false;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchQuery));
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesCity = cityFilter === "all" || p.city === cityFilter;
    return matchesSearch && matchesStatus && matchesCity;
  });

  const uniqueCities = Array.from(new Set(prospects.map(p => p.city).filter(Boolean)));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copié dans le presse-papier !");
  };

  const scriptFrWhatsApp = `Bonjour Docteur/Doctoresse 👋\n\nMerci pour votre temps. Je suis ${user?.full_name || 'votre conseiller'} de Smart Kodai POS, une plateforme spécialisée dans la gestion des cabinets et centres médicaux.\n\n✓ Organisation des rendez-vous\n✓ Rappels automatisés via WhatsApp et SMS\n✓ Dossiers médicaux numériques\n✓ Facturation et paiements\n✓ Rapports et statistiques en temps réel\n\nJe serais ravi de vous offrir une démonstration gratuite de 15 minutes pour vous présenter la plateforme et répondre à vos questions. Quel moment vous conviendrait le mieux ?\n\nCordialement,\n${user?.full_name || 'Issam Sahraoui'}\nSmart Creative Solutions\nSmart Kodai POS`;
  const scriptArWhatsApp = `السلام عليكم دكتور/دكتورة، شكراً على وقتكم. أنا ${user?.full_name || 'إسام'} من Smart Kodai POS، منصة متخصصة في إدارة العيادات والمراكز الطبية. \n\n✓ تنظيم المواعيد \n✓ تذكير المرضى عبر WhatsApp و SMS \n✓ الملفات الطبية \n✓ الفواتير والمدفوعات \n✓ تقارير وإحصائيات فورية \n\nيسعدني تقديم عرض مجاني لمدة 15 دقيقة لشرح المنصة والإجابة على أسئلتكم. ما هو الوقت المناسب لكم؟ \n\nتحياتي،\n${user?.full_name || 'Issam Sahraoui'}\nSmart Creative Solutions\nSmart Kodai POS`;
  const scriptFrEmail = `Objet : Démo Gratuite 15 min - Modernisez la gestion de votre cabinet avec Smart Kodai POS\n\nBonjour Docteur/Doctoresse,\n\nMerci pour l'échange téléphonique.\n\nEn tant que professionnel de santé, vous savez que la gestion administrative peut être chronophage.\n\nC'est pourquoi nous avons développé Smart Kodai POS, un outil marocain "tout-en-un" pour les cabinets médicaux, dentaires, kinés et infirmiers :\n- Organisation des rendez-vous et réduction des absences (rappel automatique).\n- Dossiers patients numériques et historiques.\n- Caisse visuelle et facturation instantanée.\n\nAimeriez-vous voir comment cela fonctionne ? Je vous propose une courte démonstration gratuite de 15 minutes.\n\nCordialement,\n${user?.full_name || 'Issam Sahraoui'}\nSmart Creative Solutions\nSmart Kodai POS`;
  const scriptArEmail = `الموضوع: عرض تجريبي 15 دقيقة - تطوير إدارة عيادتكم مع Smart Kodai POS\n\nالسلام عليكم دكتور/دكتورة،\n\nشكراً على وقتكم الهاتفي.\n\nنقدم لكم Smart Kodai POS، منصة متخصصة في إدارة العيادات والمراكز الطبية:\n- تنظيم المواعيد وتذكير المرضى عبر الواتساب وتقليص الغيابات.\n- الملفات الطبية الرقمية للمرضى وتتبع حالتهم.\n- حساب الصندوق والفواتير فورياً.\n\nهل ترغبون في رؤية كيف يعمل البرنامج؟ يسعدني تقديم عرض توضيحي مجاني لمدة 15 دقيقة لشرح المنصة.\n\nتحياتي،\n${user?.full_name || 'Issam Sahraoui'}\nSmart Creative Solutions\nSmart Kodai POS`;

  const statsTotal = prospects.length;
  const statsRappel = prospects.filter(p => p.status === 'rappel').length;
  const statsInteresse = prospects.filter(p => p.status === 'intéressé').length;
  const statsClient = prospects.filter(p => p.status === 'client').length;

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement du CRM...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display text-primary flex items-center gap-3">
            <PhoneCall className="w-8 h-8" />
            CRM & Prospection Commerciale
          </h1>
          <p className="text-muted-foreground mt-1">
            {user.role === 'super_admin' 
              ? "Super-Admin : Visualisez tous les prospects et assignez-les à vos commerciaux." 
              : "Espace Commercial : Vos cibles prioritaires à contacter aujourd'hui."}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Commercial: Claim Next Lead */}
          {user.role === 'sales' && (
            <Button onClick={handleClaimNextProspect} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold">
              <PhoneCall className="w-4 h-4 shrink-0" />
              Obtenir ma prochaine cible
            </Button>
          )}

          {/* Super Admin: Auto-distribute */}
          {user.role === 'super_admin' && (
            <Button 
              onClick={handleDistributeProspects} 
              disabled={distributing}
              variant="outline" 
              className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {distributing ? (
                <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Users className="w-4 h-4 text-slate-500" />
              )}
              Distribuer les cibles
            </Button>
          )}

          {/* Super Admin: Recycle Cold Leads */}
          {user.role === 'super_admin' && (
            <Dialog open={isRecycleOpen} onOpenChange={setIsRecycleOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  Recycler les fiches
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-primary font-display text-lg">
                    <RefreshCw className="w-5 h-5 text-primary" />
                    Recycler les cibles froides
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3 text-sm">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Configurez les règles d'inactivité pour libérer les fiches d'appel froides et les remettre en circulation sous le statut <span className="font-semibold text-orange-700">Recyclé</span>.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Fiches non traitées (Nouveau/Recyclé)</Label>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="number" 
                          min={1} 
                          max={90} 
                          value={inactivityDays} 
                          onChange={e => setInactivityDays(Number(e.target.value) || 7)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">jours d'inactivité après assignation</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Fiches injoignables ou refusées (Contacté/Refus)</Label>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="number" 
                          min={1} 
                          max={90} 
                          value={refusalRecycleDays} 
                          onChange={e => setRefusalRecycleDays(Number(e.target.value) || 15)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">jours sans rappel planifié</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-800 text-[11px] leading-normal flex items-start gap-2 mt-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="font-semibold">🔒 Protection active :</span> Les fiches avec un rappel programmé dans le futur ou ayant un rendez-vous à venir ne seront <span className="font-bold">jamais</span> recyclées pour protéger le travail des commerciaux.
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRecycleOpen(false)}>Annuler</Button>
                  <Button 
                    onClick={handleRecycleProspects} 
                    disabled={recycling}
                    className="bg-primary text-white gap-2"
                  >
                    {recycling ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Lancer le recyclage
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* IMPORT PROSPECTS DIALOG */}
          <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportState(); else setIsImportOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-white hover:bg-primary/90">
                <Upload className="w-4 h-4" />
                Importer des cibles
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl text-primary flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Importer des prospects (Excel / CSV)
                </DialogTitle>
              </DialogHeader>

              <div className="py-2 space-y-4">
                {/* Step 1: Upload and strategy selection */}
                {importStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">1. Gestion des doublons :</Label>
                        <Select 
                          value={duplicateStrategy} 
                          onValueChange={(val: any) => setDuplicateStrategy(val)}
                        >
                          <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">⚠️ Ignorer les doublons</SelectItem>
                            <SelectItem value="update">🔄 Mettre à jour les fiches</SelectItem>
                            <SelectItem value="allow">➕ Tout importer (doublons autorisés)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">2. Critère de dédoublement :</Label>
                        <Select 
                          value={duplicateCriteria} 
                          onValueChange={(val: any) => setDuplicateCriteria(val)}
                          disabled={duplicateStrategy === 'allow'}
                        >
                          <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone_or_email">Téléphone OU E-mail</SelectItem>
                            <SelectItem value="phone">Téléphone uniquement</SelectItem>
                            <SelectItem value="email">E-mail uniquement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {duplicateStrategy !== 'allow' && (
                      <p className="text-[10px] text-muted-foreground">
                        Un doublon sera détecté si le champ{" "}
                        <span className="font-semibold text-primary">
                          {duplicateCriteria === 'phone_or_email' && "Téléphone ou E-mail"}
                          {duplicateCriteria === 'phone' && "Téléphone"}
                          {duplicateCriteria === 'email' && "E-mail"}
                        </span>{" "}
                        du fichier existe déjà dans le CRM.
                      </p>
                    )}

                    <div className="border-2 border-dashed border-slate-200 hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-slate-50/50 relative cursor-pointer group">
                      <input 
                        type="file" 
                        accept=".csv,.xlsx,.xls" 
                        onChange={handleFileChange}
                        disabled={importing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-3">
                        <Upload className="w-10 h-10 mx-auto text-slate-400 group-hover:text-primary transition-colors" />
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Glissez-déposez ou cliquez pour téléverser</p>
                          <p className="text-xs text-muted-foreground mt-1">Formats acceptés : Excel (.xlsx, .xls) ou CSV (.csv)</p>
                        </div>
                        {importing && (
                          <div className="text-xs text-primary font-medium animate-pulse">
                            Lecture et analyse du fichier en cours...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Mapping columns */}
                {importStep === 2 && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">
                        📄 Fichier : <span className="font-bold text-slate-900">{importFile?.name}</span> ({importRows.length} lignes détectées)
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setImportStep(1)} className="text-xs h-7 text-muted-foreground">
                        Changer de fichier
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-slate-700">2. Associez les colonnes de votre fichier aux champs :</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { field: 'name', label: 'Nom du Prospect *', required: true },
                          { field: 'phone', label: 'Téléphone (GSM)', required: false },
                          { field: 'email', label: 'E-mail', required: false },
                          { field: 'city', label: 'Ville', required: false },
                          { field: 'specialty', label: 'Spécialité / Métier', required: false },
                          { field: 'notes', label: 'Remarques / Notes', required: false }
                        ].map(({ field, label, required }) => (
                          <div key={field} className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              {label}
                            </Label>
                            <Select 
                              value={columnMapping[field] || "none"}
                              onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [field]: val === "none" ? "" : val }))}
                            >
                              <SelectTrigger className={`w-full text-xs h-9 bg-white ${required && !columnMapping[field] ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'}`}>
                                <SelectValue placeholder="Ne pas importer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- Ne pas importer --</SelectItem>
                                {importHeaders.map(h => (
                                  <SelectItem key={h} value={h}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-[11px] text-amber-600 font-semibold">
                        * Le champ Nom est obligatoire.
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={resetImportState}>
                          Annuler
                        </Button>
                        <Button 
                          size="sm" 
                          disabled={!columnMapping.name || importing}
                          onClick={() => setImportStep(3)}
                          className="bg-primary text-white"
                        >
                          Voir l'aperçu
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Preview */}
                {importStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-700">3. Aperçu des premières lignes avant importation :</div>
                    
                    <div className="border rounded-lg overflow-x-auto bg-white max-h-60">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs py-2">Nom</TableHead>
                            <TableHead className="text-xs py-2">Téléphone</TableHead>
                            <TableHead className="text-xs py-2">Email</TableHead>
                            <TableHead className="text-xs py-2">Ville</TableHead>
                            <TableHead className="text-xs py-2">Spécialité</TableHead>
                            <TableHead className="text-xs py-2">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importRows.slice(0, 3).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs py-2 font-medium">{columnMapping.name ? row[columnMapping.name] : ''}</TableCell>
                              <TableCell className="text-xs py-2">{columnMapping.phone ? row[columnMapping.phone] : ''}</TableCell>
                              <TableCell className="text-xs py-2">{columnMapping.email ? row[columnMapping.email] : ''}</TableCell>
                              <TableCell className="text-xs py-2">{columnMapping.city ? row[columnMapping.city] : ''}</TableCell>
                              <TableCell className="text-xs py-2">{columnMapping.specialty ? row[columnMapping.specialty] : ''}</TableCell>
                              <TableCell className="text-xs py-2 truncate max-w-[100px]">{columnMapping.notes ? row[columnMapping.notes] : ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1.5">
                      <p className="font-semibold text-slate-700">🔍 Résumé de l'opération :</p>
                      <p>• Total à traiter : <span className="font-bold text-slate-900">{importRows.length} lignes</span></p>
                      <p>• Stratégie doublons : <span className="font-bold text-primary">
                        {duplicateStrategy === 'skip' && 'Ignorer les doublons'}
                        {duplicateStrategy === 'update' && 'Mettre à jour les doublons'}
                        {duplicateStrategy === 'allow' && 'Conserver et créer des doublons'}
                      </span></p>
                      {duplicateStrategy !== 'allow' && (
                        <p>• Critère de dédoublement : <span className="font-bold text-slate-700">
                          {duplicateCriteria === 'phone_or_email' && "Téléphone OU E-mail"}
                          {duplicateCriteria === 'phone' && "Téléphone uniquement"}
                          {duplicateCriteria === 'email' && "E-mail uniquement"}
                        </span></p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => setImportStep(2)} disabled={importing}>
                        Retour au mapping
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleImportSubmit}
                        disabled={importing}
                        className="bg-primary text-white gap-1.5"
                      >
                        {importing ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Lancer l'importation
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Success Report */}
                {importStep === 4 && importResult && (
                  <div className="space-y-4 text-center py-4">
                    <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Check className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Importation terminée !</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Le fichier a été traité avec succès dans la base de données.
                      </p>
                      <div className="mt-3 py-2 px-4 bg-slate-100/80 rounded-lg border text-xs font-semibold text-slate-700 max-w-sm mx-auto">
                        📊 Total injecté/traité : {importResult.inserted + importResult.updated} fiches
                        <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">
                          sur un total de {importResult.inserted + importResult.updated + importResult.skipped} lignes lues.
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
                      <div className="bg-green-50 border border-green-100 p-3 rounded-lg">
                        <div className="text-xl font-bold text-green-900">{importResult.inserted}</div>
                        <div className="text-[10px] text-green-700 font-medium mt-0.5">Nouveaux</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        <div className="text-xl font-bold text-blue-900">{importResult.updated}</div>
                        <div className="text-[10px] text-blue-700 font-medium mt-0.5">Mis à jour</div>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                        <div className="text-xl font-bold text-amber-900">{importResult.skipped}</div>
                        <div className="text-[10px] text-amber-700 font-medium mt-0.5">Ignorés / Exclus</div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <Button onClick={resetImportState} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                        Fermer la fenêtre
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* SCRIPTS & MODEL DIALOG (EXISTING) */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <MessageSquareText className="w-4 h-4" />
                Scripts & Modèles de messages
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-primary flex items-center gap-2">
                <MessageSquareText className="w-5 h-5" />
                Scripts & Formation Commerciale
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Tabs defaultValue="messages" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="messages">Modèles de Messages</TabsTrigger>
                  <TabsTrigger value="training">Formation & Objections</TabsTrigger>
                </TabsList>
                
                <TabsContent value="messages" className="space-y-4">
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100">
                      <TabsTrigger value="fr">Français</TabsTrigger>
                      <TabsTrigger value="ar">العربية</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="fr" className="space-y-6">
                      <div className="space-y-2 relative">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-green-600 flex items-center gap-2">
                            <PhoneCall className="w-4 h-4" /> Message WhatsApp
                          </h3>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptFrWhatsApp)}>
                            <Copy className="w-4 h-4 mr-2" /> Copier
                          </Button>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-sm text-green-900 font-medium whitespace-pre-wrap border border-green-100">
                          {scriptFrWhatsApp}
                        </div>
                      </div>

                      <div className="space-y-2 relative">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-blue-600 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email Professionnel
                          </h3>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptFrEmail)}>
                            <Copy className="w-4 h-4 mr-2" /> Copier
                          </Button>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900 whitespace-pre-wrap border border-blue-100">
                          {scriptFrEmail}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="ar" className="space-y-6">
                      <div className="space-y-2 relative">
                        <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
                          <h3 className="font-semibold text-emerald-600 flex items-center gap-2">
                            <PhoneCall className="w-4 h-4" /> رسالة واتساب
                          </h3>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptArWhatsApp)}>
                            <Copy className="w-4 h-4 ml-2" /> نسخ
                          </Button>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-lg text-sm text-emerald-900 font-medium whitespace-pre-wrap border border-emerald-100 text-right" dir="rtl">
                          {scriptArWhatsApp}
                        </div>
                      </div>

                      <div className="space-y-2 relative">
                        <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
                          <h3 className="font-semibold text-sky-600 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> إيميل احترافي
                          </h3>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(scriptArEmail)}>
                            <Copy className="w-4 h-4 ml-2" /> نسخ
                          </Button>
                        </div>
                        <div className="bg-sky-50 p-4 rounded-lg text-sm text-sky-900 whitespace-pre-wrap border border-sky-100 text-right" dir="rtl">
                          {scriptArEmail}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="training" className="space-y-4 mt-2">
                  <div className="bg-slate-50 border rounded-xl p-4 md:p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          Simulateur Commercial Interactif (Scripts & Objections)
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Préparez-vous à l'appel en simulant les réponses et les objections des médecins en temps réel.
                        </p>
                      </div>
                      
                      <div className="flex bg-slate-100 rounded-lg p-0.5 border text-xs w-fit">
                        <Button 
                          variant={simLang === "fr" ? "secondary" : "ghost"} 
                          size="sm" 
                          onClick={() => setSimLang("fr")}
                          className="h-7 text-xs px-3 font-semibold shadow-none"
                        >
                          Français
                        </Button>
                        <Button 
                          variant={simLang === "ar" ? "secondary" : "ghost"} 
                          size="sm" 
                          onClick={() => setSimLang("ar")}
                          className="h-7 text-xs px-3 font-semibold shadow-none"
                        >
                          العربية (Darija)
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      const node = scriptNodes[currentNodeId] || scriptNodes.start;
                      const text = simLang === "fr" ? node.textFr : node.textAr;
                      return (
                        <div className="space-y-6">
                          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm relative space-y-4">
                            <Badge className="absolute -top-3 left-4 bg-primary text-white font-medium text-[11px] px-2 py-0.5">
                              {node.badge}
                            </Badge>
                            
                            <div className="flex justify-between items-start gap-4 pt-1">
                              <h4 className="font-bold text-slate-800 text-sm">
                                {node.title}
                              </h4>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  const textToCopy = text.replace(/"/g, '').replace('[Votre Nom]', user?.full_name || 'Issam').replace('[اسمك]', user?.full_name || 'إسام');
                                  copyToClipboard(textToCopy);
                                }}
                                className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copier le script
                              </Button>
                            </div>

                            <div className="bg-slate-50 border rounded-xl p-4 text-slate-900 text-sm italic font-medium leading-relaxed relative before:content-[''] before:absolute before:left-6 before:-bottom-2 before:w-4 before:h-4 before:bg-slate-50 before:border-r before:border-b before:rotate-45 before:border-slate-200">
                              <span className="text-primary font-bold not-italic mr-1.5">🗣️ CE QUE VOUS DEVEZ DIRE :</span>
                              {text.replace('[Votre Nom]', user?.full_name || 'Issam').replace('[اسمك]', user?.full_name || 'إسام')}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              {simLang === "fr" ? "Sélectionnez le choix ou l'objection du médecin :" : "اختر رد الطبيب أو نوع اعتراضه :"}
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {node.options.map((opt, i) => {
                                let btnClass = "border text-xs justify-start h-12 text-left font-semibold hover:bg-slate-50";
                                if (opt.type === "success") {
                                  btnClass = "border-green-200 bg-green-50/50 text-green-800 justify-start h-12 text-left font-semibold hover:bg-green-50 hover:border-green-300";
                                } else if (opt.type === "destructive") {
                                  btnClass = "border-rose-200 bg-rose-50/50 text-rose-800 justify-start h-12 text-left font-semibold hover:bg-rose-50 hover:border-rose-300";
                                } else if (opt.type === "warning") {
                                  btnClass = "border-amber-200 bg-amber-50/50 text-amber-800 justify-start h-12 text-left font-semibold hover:bg-amber-50 hover:border-amber-300";
                                } else if (opt.type === "primary") {
                                  btnClass = "border-blue-200 bg-blue-50/50 text-blue-800 justify-start h-12 text-left font-semibold hover:bg-blue-50 hover:border-blue-300";
                                }
                                return (
                                  <Button
                                    key={i}
                                    variant="outline"
                                    onClick={() => setCurrentNodeId(opt.nextNodeId)}
                                    className={`${btnClass} w-full`}
                                    dir={simLang === "ar" ? "rtl" : "ltr"}
                                  >
                                    <span className="truncate">
                                      {simLang === "fr" ? opt.labelFr : opt.labelAr}
                                    </span>
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          {currentNodeId !== "start" && (
                            <div className="flex justify-end pt-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setCurrentNodeId("start")}
                                className="text-xs text-muted-foreground hover:text-primary gap-1"
                              >
                                🔄 Recommencer depuis le début
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      {/* ============ STATISTICS DASHBOARD ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <Card className="bg-blue-50/40 border-blue-100/70 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Cibles</p>
              <h3 className="text-2xl font-bold text-blue-900">{statsTotal}</h3>
            </div>
            <div className="p-3 bg-blue-100/60 rounded-xl text-blue-700">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50/40 border-yellow-100/70 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Rappels à faire</p>
              <h3 className="text-2xl font-bold text-yellow-900">{statsRappel}</h3>
            </div>
            <div className="p-3 bg-yellow-100/60 rounded-xl text-yellow-700">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/40 border-purple-100/70 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Intéressés / RDV</p>
              <h3 className="text-2xl font-bold text-purple-900">{statsInteresse}</h3>
            </div>
            <div className="p-3 bg-purple-100/60 rounded-xl text-purple-700">
              <PhoneCall className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50/40 border-green-100/70 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Convertis (Clients)</p>
              <h3 className="text-2xl font-bold text-green-900">{statsClient}</h3>
            </div>
            <div className="p-3 bg-green-100/60 rounded-xl text-green-700">
              <Shield className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Rechercher un prospect ou n° de téléphone..." 
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto items-center">
          {(searchQuery || cityFilter !== "all" || statusFilter !== "all") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchQuery("");
                setCityFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs text-muted-foreground hover:text-primary h-8"
            >
              Réinitialiser
            </Button>
          )}

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
              <MapPin className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {uniqueCities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="nouveau">🔵 Nouveau</SelectItem>
              <SelectItem value="recyclé">♻️ Recyclé</SelectItem>
              <SelectItem value="sans_reponse">⚪ Sans Réponse</SelectItem>
              <SelectItem value="contacte">💬 Contact Établi</SelectItem>
              <SelectItem value="rappel">🟡 Rappel Planifié</SelectItem>
              <SelectItem value="pas_interesse">❌ Pas Intéressé (Temp)</SelectItem>
              <SelectItem value="refus_definitif">🚫 Refus Définitif</SelectItem>
              <SelectItem value="intéressé">🟣 Intéressé / RDV</SelectItem>
              <SelectItem value="client">🟢 Converti (Client)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Prospect & Spécialité</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              {user.role === 'super_admin' && <TableHead>Assigné à</TableHead>}
              <TableHead className="text-right">Actions Rapides</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.map(p => (
              <TableRow key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                <TableCell className="align-top py-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {getInitials(p.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3 shrink-0" /> {p.specialty}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" /> {p.city || "Ville inconnue"}</span>
                      </div>
                      
                      {p.callback_at && (() => {
                        const overdue = isCallbackOverdue(p.callback_at);
                        const formattedDate = new Date(p.callback_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
                        return overdue ? (
                          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 mt-2 max-w-sm flex items-center gap-1.5 font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Rappel en retard : {formattedDate}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-2 mt-2 max-w-sm flex items-center gap-1.5 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Rappel programmé : {formattedDate}</span>
                          </div>
                        );
                      })()}

                      <div className="mt-2.5 max-w-sm">
                        <Textarea
                          placeholder="Saisissez vos remarques de suivi..."
                          className="text-xs h-16 min-h-16 resize-y bg-slate-50/30 hover:bg-slate-50/80 focus:bg-white border-slate-100 hover:border-slate-200 focus:border-primary/50 transition-all shadow-none focus:shadow-sm"
                          value={p.notes || ""}
                          onChange={(e) => handleNotesChangeLocal(p.id, e.target.value)}
                          onBlur={() => handleNotesBlur(p.id)}
                        />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2 text-xs">
                    {p.phone ? (
                      <div className="flex flex-col gap-1.5">
                        <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-medium" title="Appeler (Appel normal)">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {p.phone}
                        </a>
                        <a href={`https://wa.me/${p.phone.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-green-600 hover:text-green-700 font-medium" title="Envoyer un message WhatsApp">
                          <MessageSquareText className="w-3.5 h-3.5 shrink-0" /> WhatsApp
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                    {p.email && (
                      <div className="flex items-center gap-1.5 text-slate-500 border-t border-slate-100 pt-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate max-w-[150px]">{p.email}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={(v) => handleStatusChange(p.id, v)}>
                    <SelectTrigger className={`w-[130px] h-8 text-xs font-semibold ${getStatusColor(p.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nouveau">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Nouveau
                        </div>
                      </SelectItem>
                      <SelectItem value="recyclé">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Recyclé
                        </div>
                      </SelectItem>
                      <SelectItem value="sans_reponse">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Sans Réponse
                        </div>
                      </SelectItem>
                      <SelectItem value="contacte">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Contact Établi
                        </div>
                      </SelectItem>
                      <SelectItem value="rappel">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Rappel Planifié
                        </div>
                      </SelectItem>
                      <SelectItem value="pas_interesse">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pas Intéressé
                        </div>
                      </SelectItem>
                      <SelectItem value="refus_definitif">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> Refus Définitif
                        </div>
                      </SelectItem>
                      <SelectItem value="intéressé">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Intéressé / RDV
                        </div>
                      </SelectItem>
                      <SelectItem value="client">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Client
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                {user.role === 'super_admin' && (
                  <TableCell>
                    <Select value={p.assigned_to || 'none'} onValueChange={(v) => handleAssignChange(p.id, v)}>
                      <SelectTrigger className={`w-[140px] h-8 text-xs bg-slate-50 ${!p.assigned_to ? 'border-amber-200 text-amber-700 bg-amber-50/40 font-medium' : 'border-slate-200'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non assigné</SelectItem>
                        {agents.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setEditingProspect(p);
                        setEditEmail(p.email || "");
                        setEditNotes(p.notes || "");
                        setEditStatus(p.status || "nouveau");
                        setEditCallbackAt(p.callback_at || "");
                        setHasCallback(!!p.callback_at);
                        setEditRdvAt("");
                        setHasRdv(false);
                      }}
                      className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg"
                      title="Modifier les remarques / email"
                    >
                      <MessageSquareText className="w-4 h-4 text-slate-500" />
                    </Button>
                    {p.phone ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                            <PhoneCall className="w-3 h-3 shrink-0" />
                            Contacter
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-md w-72 max-h-[80vh] overflow-y-auto">
                          <DropdownMenuItem asChild>
                            <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 w-full cursor-pointer">
                              <Phone className="w-4 h-4 text-slate-500" />
                              <span className="font-semibold text-slate-700">Appel GSM (Normal)</span>
                            </a>
                          </DropdownMenuItem>

                          <div className="border-t my-1" />
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Messages en Français</div>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.intro(p.name, p.city, user?.full_name || "Votre conseiller"))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-blue-600" />
                              <span>🚀 WhatsApp : Introduction</span>
                            </a>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.missed(p.name, p.city, user?.full_name || "Votre conseiller"))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-slate-500" />
                              <span>⏳ WhatsApp : Injoignable</span>
                            </a>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.confirm(p.name, p.city, user?.full_name || "Votre conseiller", p.callback_at ? new Date(p.callback_at).toLocaleDateString('fr-FR') : '[Date]', p.callback_at ? new Date(p.callback_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '[Heure]'))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-green-600" />
                              <span>🗓️ WhatsApp : Confirmer RDV</span>
                            </a>
                          </DropdownMenuItem>

                          <div className="border-t my-1" />
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">الرسائل بالدارجة</div>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.intro(p.name, p.city, user?.full_name || "مستشاركم"))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs justify-end text-right"
                              dir="rtl"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-blue-600 ml-2" />
                              <span>🚀 واتساب : رسالة التقديم</span>
                            </a>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.missed(p.name, p.city, user?.full_name || "مستشاركم"))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs justify-end text-right"
                              dir="rtl"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-slate-500 ml-2" />
                              <span>⏳ واتساب : تعذر الاتصال</span>
                            </a>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://wa.me/${p.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.confirm(p.name, p.city, user?.full_name || "مستشاركم", p.callback_at ? new Date(p.callback_at).toLocaleDateString('fr-FR') : '[التاريخ]', p.callback_at ? new Date(p.callback_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '[الساعة]'))}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-2 w-full cursor-pointer text-xs justify-end text-right"
                              dir="rtl"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-green-600 ml-2" />
                              <span>🗓️ واتساب : تأكيد الموعد</span>
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pas de numéro</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProspects.length === 0 && (
              <TableRow>
                <TableCell colSpan={user.role === 'super_admin' ? 5 : 4} className="text-center py-12 text-slate-500">
                  Aucun prospect trouvé avec ces filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ============ EDIT PROSPECT DIALOG ============ */}
      <Dialog open={!!editingProspect} onOpenChange={(open) => !open && setEditingProspect(null)}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">
              Qualifier le prospect : {editingProspect?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Statut / Qualification</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nouveau">🔵 Nouveau</SelectItem>
                  <SelectItem value="recyclé">♻️ Recyclé</SelectItem>
                  <SelectItem value="sans_reponse">⚪ Sans Réponse (Injoignable)</SelectItem>
                  <SelectItem value="contacte">💬 Contact Établi</SelectItem>
                  <SelectItem value="rappel">🟡 Rappel Planifié</SelectItem>
                  <SelectItem value="pas_interesse">❌ Pas Intéressé (Temporaire)</SelectItem>
                  <SelectItem value="refus_definitif">🚫 Refus Définitif (Ne plus appeler)</SelectItem>
                  <SelectItem value="intéressé">🟣 Intéressé / RDV</SelectItem>
                  <SelectItem value="client">🟢 Converti (Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Remarques / Notes de suivi</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Saisissez vos remarques ou notes de suivi ici..."
                rows={4}
              />
            </div>

            {editingProspect?.phone && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5 text-green-600" />
                    Raccourcis WhatsApp
                  </span>
                  <span className="text-[10px] text-muted-foreground">Envoi en 1 clic</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.intro(editingProspect.name, editingProspect.city, user?.full_name || "Votre conseiller"))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border rounded-lg transition-colors shadow-sm"
                  >
                    🇫🇷 Introduction
                  </a>
                  <a
                    href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.intro(editingProspect.name, editingProspect.city, user?.full_name || "مستشاركم"))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border rounded-lg transition-colors shadow-sm animate-pulse"
                  >
                    🇲🇦 التقديم (Darija)
                  </a>
                  <a
                    href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.missed(editingProspect.name, editingProspect.city, user?.full_name || "Votre conseiller"))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border rounded-lg transition-colors shadow-sm"
                  >
                    🇫🇷 Injoignable
                  </a>
                  <a
                    href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.missed(editingProspect.name, editingProspect.city, user?.full_name || "مستشاركم"))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 border rounded-lg transition-colors shadow-sm"
                  >
                    🇲🇦 تعذر الاتصال
                  </a>
                </div>
                {hasCallback && editCallbackAt && (
                  <div className="pt-1 space-y-1.5">
                    <a
                      href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.fr.confirm(editingProspect.name, editingProspect.city, user?.full_name || "Votre conseiller", new Date(editCallbackAt).toLocaleDateString('fr-FR'), new Date(editCallbackAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-green-50 hover:bg-green-100 text-xs font-bold text-green-700 border border-green-200 rounded-lg transition-colors shadow-sm"
                    >
                      🗓️ Confirmation Rappel (FR)
                    </a>
                    <a
                      href={`https://wa.me/${editingProspect.phone.replace(/\s+/g, '')}?text=${encodeURIComponent(whatsappTemplates.ar.confirm(editingProspect.name, editingProspect.city, user?.full_name || "مستشاركم", new Date(editCallbackAt).toLocaleDateString('fr-FR'), new Date(editCallbackAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-green-50 hover:bg-green-100 text-xs font-bold text-green-700 border border-green-200 rounded-lg transition-colors shadow-sm"
                      dir="rtl"
                    >
                      🗓️ إرسال تأكيد الموعد (AR)
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-3 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="schedule-callback" 
                  checked={hasCallback} 
                  onCheckedChange={(checked) => setHasCallback(!!checked)} 
                />
                <Label htmlFor="schedule-callback" className="cursor-pointer text-sm font-semibold text-slate-700">
                  Planifier un rappel (Callback)
                </Label>
              </div>

              {hasCallback && (
                <div className="pl-6 space-y-2">
                  <Label>Date & Heure du rappel</Label>
                  <Input 
                    type="datetime-local" 
                    value={editCallbackAt} 
                    onChange={e => setEditCallbackAt(e.target.value)} 
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="schedule-rdv" 
                  checked={hasRdv} 
                  onCheckedChange={(checked) => setHasRdv(!!checked)} 
                />
                <Label htmlFor="schedule-rdv" className="cursor-pointer text-sm font-semibold text-slate-700">
                  Programmer un Rendez-vous (Agenda)
                </Label>
              </div>

              {hasRdv && (
                <div className="pl-6 space-y-2">
                  <Label>Date & Heure du RDV</Label>
                  <Input 
                    type="datetime-local" 
                    value={editRdvAt} 
                    onChange={e => setEditRdvAt(e.target.value)} 
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProspect(null)}>Annuler</Button>
            <Button onClick={handleSaveProspect} disabled={savingProspect}>
              {savingProspect ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
