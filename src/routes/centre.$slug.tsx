import { createFileRoute, Navigate } from "@tanstack/react-router";
import { getTenantPublicProfileAction, createPublicAppointmentRequestAction } from "@/lib/actions";
import { useState } from "react";
import { MapPin, Stethoscope, Phone, User, MessageSquare, ArrowRight, Building2, CheckCircle2, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/centre/$slug")({
  component: CentreVitrinePage,
  loader: async ({ params }) => {
    const profile = await getTenantPublicProfileAction({ data: { slug: params.slug } });
    return { profile };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.profile?.name ?? "Centre de santé";
    const desc = loaderData?.profile?.description ?? "Prenez rendez-vous en ligne facilement.";
    return {
      meta: [
        { title: `${name} — Prise de RDV en ligne` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — Prise de RDV en ligne` },
        { property: "og:description", content: desc },
      ]
    };
  }
});

function CentreVitrinePage() {
  const { profile } = Route.useLoaderData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!profile || profile.isExpired) {
    return <Navigate to="/" />;
  }

  const primaryColor = profile.color || "#8b4513";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Veuillez renseigner votre nom et votre téléphone.");
      return;
    }
    setSubmitting(true);
    try {
      await createPublicAppointmentRequestAction({
        data: { tenantId: profile.id, name, phone, motif }
      });
      setSuccess(true);
      setName(""); setPhone(""); setMotif("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* HERO HEADER */}
      <header
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 60%, ${primaryColor}88 100%)` }}
      >
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
          style={{ background: "rgba(255,255,255,0.3)" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.4)" }}
        />

        <div className="relative max-w-3xl mx-auto px-6 py-16 flex flex-col items-center text-center text-white">
          <div className="mb-6">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt={`Logo ${profile.name}`}
                className="w-24 h-24 rounded-2xl object-cover shadow-2xl border-4 border-white/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-2xl border-4 border-white/30">
                <Building2 className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight drop-shadow-md mb-3">
            {profile.name}
          </h1>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {profile.specialty && (
              <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white text-sm font-medium px-4 py-1.5 rounded-full border border-white/30">
                <Stethoscope className="w-4 h-4" />
                {profile.specialty}
              </span>
            )}
            {profile.city && (
              <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white text-sm font-medium px-4 py-1.5 rounded-full border border-white/30">
                <MapPin className="w-4 h-4" />
                {profile.city}
              </span>
            )}
          </div>

          
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {profile.facebook_url && (
              <a href={profile.facebook_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {profile.instagram_url && (
              <a href={profile.instagram_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {profile.whatsapp_number && (
              <a href={`https://wa.me/${profile.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <Phone className="w-5 h-5" />
              </a>
            )}
            {profile.google_maps_url && (
              <a href={profile.google_maps_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <MapPin className="w-5 h-5" />
              </a>
            )}
          </div>

          {profile.description && (
            <p className="text-white/85 text-lg max-w-xl leading-relaxed">
              {profile.description}
            </p>
          )}

          <a
            href="#rdv"
            className="mt-8 inline-flex items-center gap-2 bg-white font-bold text-sm px-8 py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
            style={{ color: primaryColor }}
          >
            Prendre un rendez-vous
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* TRUST BAR */}
      <div className="bg-white border-b border-gray-100 py-4">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          {["Prise de RDV gratuite", "Réponse rapide", "Centre certifié"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10">

        {profile.services && profile.services.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ChevronRight className="w-5 h-5" style={{ color: primaryColor }} />
              Prestations et Tarifs
            </h2>
            <div className="space-y-3">
              {profile.services.map((svc: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <h3 className="font-medium text-gray-800">{svc.name}</h3>
                    {svc.duration && <p className="text-xs text-gray-400 mt-1">{svc.duration}</p>}
                  </div>
                  {svc.price && (
                    <div className="font-bold text-gray-900 bg-gray-50 px-3 py-1 rounded-md">
                      {svc.price}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.gallery && profile.gallery.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" style={{ color: primaryColor }} />
              Galerie Photos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {profile.gallery.map((img: string, idx: number) => (
                <a key={idx} href={img} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden group">
                  <img src={img} alt="Galerie" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                </a>
              ))}
            </div>
          </section>
        )}

        {profile.description && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ChevronRight className="w-5 h-5" style={{ color: primaryColor }} />
              À propos du centre
            </h2>
            <p className="text-gray-600 leading-relaxed">{profile.description}</p>
          </section>
        )}

        <section id="rdv" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <ChevronRight className="w-5 h-5" style={{ color: primaryColor }} />
            Demander un rendez-vous
          </h2>
          <p className="text-sm text-gray-400 mb-7">
            Laissez vos coordonnées et le centre vous rappellera pour confirmer votre rendez-vous.
          </p>

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
              <CheckCircle2 className="w-14 h-14" style={{ color: primaryColor }} />
              <p className="text-lg font-bold text-gray-800">Demande envoyée !</p>
              <p className="text-sm text-gray-500">
                Le centre a bien reçu votre demande et vous contactera dans les plus brefs délais.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 text-sm font-medium underline"
                style={{ color: primaryColor }}
              >
                Soumettre une autre demande
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" /> Nom complet *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex : Fatima Zahra Benali"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" /> Téléphone *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="Ex : 0612345678"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-gray-400" /> Motif de la consultation
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex : Consultation générale, urgence dentaire..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 resize-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              >
                {submitting ? (
                  <span className="animate-pulse">Envoi en cours...</span>
                ) : (
                  <>
                    Envoyer ma demande
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400">
                Vos données sont confidentielles et utilisées uniquement pour la prise de rendez-vous.
              </p>
            </form>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-8 text-xs text-gray-400 border-t border-gray-100 bg-white">
        <p>
          Page propulsée par{" "}
          <a
            href="/"
            className="font-semibold hover:underline"
            style={{ color: primaryColor }}
          >
            SyncAPOS
          </a>{" "}
          · La solution de gestion N°1 pour les professionnels de santé au Maroc.
        </p>
      </footer>
    </div>
  );
}
