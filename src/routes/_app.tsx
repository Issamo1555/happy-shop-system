import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/AppSidebar";
import { CartProvider } from "@/lib/cart-context";
import { useState } from "react";
import { AlertTriangle, ShieldAlert, LogOut, X, Upload, CheckCircle2 } from "lucide-react";
import { uploadPaymentProofAction } from "@/lib/actions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const moduleRoutes: Record<string, string> = {
  "/caisse": "caisse",
  "/catalogue": "catalogue",
  "/clients": "clients",
  "/agenda": "agenda",
  "/historique": "historique",
  "/tickets": "tickets",
  "/crm": "crm",
  "/guide-stage": "crm",
};

function AppLayout() {
  const { isAuthenticated, loading, isStaff, user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [hideBanner, setHideBanner] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("hide_subscription_banner") === "true";
    }
    return false;
  });

  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState(user?.payment_proof_url || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await uploadPaymentProofAction({
          data: {
            tenantId: user.tenant_id,
            base64,
            filename: file.name,
            userId: user.id
          }
        });
        setProofUrl(res.url);
        toast.success("Justificatif de paiement envoyé !");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du téléversement");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-2xl text-muted-foreground animate-pulse">
          Chargement...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center pos-card p-8">
          <h1 className="font-display text-2xl text-primary mb-2">Accès en attente</h1>
          <p className="text-muted-foreground">
            Votre compte n'a pas encore de rôle assigné. Contactez l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  // Calculate subscription status
  const isSuperAdmin = user?.role === 'super_admin';
  const hasSubscription = !!user?.subscription_end_date;
  
  const isExpired = (() => {
    if (isSuperAdmin || !hasSubscription) return false;
    const endDate = new Date(user.subscription_end_date);
    return new Date() > endDate;
  })();

  const daysRemaining = (() => {
    if (isSuperAdmin || !hasSubscription || isExpired) return null;
    const endDate = new Date(user.subscription_end_date);
    const diffTime = endDate.getTime() - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })();

  // Render lockout screen if expired
  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
            <ShieldAlert className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-slate-800">Accès Suspendu</h1>
            <p className="text-sm text-slate-500">
              L'abonnement de votre centre (<strong>{user?.tenant_name || "Établissement"}</strong>) a expiré le{" "}
              <span className="font-semibold text-red-600">
                {new Date(user.subscription_end_date).toLocaleDateString("fr-FR")}
              </span>.
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 leading-relaxed text-left border">
            Pour réactiver l'accès à vos fonctionnalités de caisse, d'agenda et de prospection, veuillez contacter le super-administrateur de la plateforme ou renouveler votre formule.
          </div>

          {/* UPLOAD FORM */}
          <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 space-y-4">
            {proofUrl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Justificatif de paiement envoyé !</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Le super-administrateur a été notifié et procède à la validation de votre accès.
                </p>
                <div className="text-xs">
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                    Voir le document envoyé
                  </a>
                </div>
                <div className="pt-2 border-t text-[10px] text-muted-foreground">
                  Vous pouvez charger un nouveau fichier si nécessaire :
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700">Envoyer une preuve de virement</h3>
                <p className="text-xs text-slate-400">
                  Déposez votre capture d'écran de paiement pour accélérer la réactivation.
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-center">
              <label 
                htmlFor="lockout-proof-upload"
                className={`inline-flex items-center justify-center gap-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 h-9 px-4 cursor-pointer transition-colors shadow-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Envoi..." : proofUrl ? "Remplacer le justificatif" : "Choisir un fichier"}
              </label>
              <input 
                id="lockout-proof-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a 
              href="mailto:contact@smartcodai.com" 
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
            >
              Contacter le support
            </a>
            <button 
              onClick={() => signOut()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Route protection for disabled modules
  const matchedRoute = Object.keys(moduleRoutes).find(route => pathname.startsWith(route));
  if (matchedRoute) {
    const requiredModule = moduleRoutes[matchedRoute];
    if (user?.enabled_modules && !user.enabled_modules.includes(requiredModule)) {
      return <Navigate to="/dashboard" />;
    }
  }

  const handleCloseBanner = () => {
    setHideBanner(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hide_subscription_banner", "true");
    }
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {daysRemaining !== null && daysRemaining <= 5 && !hideBanner && (
          <div className="bg-amber-500 text-white text-xs sm:text-sm font-medium px-4 py-2.5 flex items-center justify-between shadow-md relative z-50 animate-fadeIn shrink-0">
            <div className="flex items-center gap-2 mx-auto">
              <AlertTriangle className="w-4 h-4 animate-pulse shrink-0" />
              <span>
                Attention : L'abonnement de votre centre expire dans <strong>{daysRemaining} jour(s)</strong> (le {new Date(user.subscription_end_date).toLocaleDateString("fr-FR")}). Veuillez régulariser votre situation.
              </span>
            </div>
            <button 
              onClick={handleCloseBanner}
              className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors absolute right-2 top-1/2 -translate-y-1/2"
              title="Masquer l'alerte"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex flex-1 relative">
          <AppSidebar />
          <main className="lg:pl-64 flex flex-col flex-1 min-h-screen transition-all duration-300">
            <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-6 py-6 pt-20 lg:pt-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </CartProvider>
  );
}
