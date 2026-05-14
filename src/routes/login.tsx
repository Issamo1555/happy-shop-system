import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import bg from "@/assets/login-bg.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { resetPassword } = useAuth();

  if (!loading && isAuthenticated) {
    return <Navigate to="/caisse" />;
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success("Bienvenue");
    } catch (err: any) {
      toast.error(err.message ?? "Connexion impossible");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signUp(email, password, name, inviteCode);
      toast.success("Compte créé. Vous pouvez vous connecter.");
    } catch (err: any) {
      toast.error(err.message ?? "Inscription impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.8) contrast(1.1)'
        }}
      />
      
      {/* Overlay for contrast */}
      <div className="absolute inset-0 bg-black/10 z-0" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/70 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl shadow-black/20">
          <div className="text-center mb-8">
            <img src={logo} alt="Logo Mums'Home" className="w-24 h-24 mx-auto mb-4 drop-shadow-sm" />
            <h1 className="font-display text-3xl text-primary mb-1">Mums'Home</h1>
            <p className="text-muted-foreground text-sm uppercase tracking-widest">Parentalité & Co</p>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/30 p-1">
              <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-white">Connexion</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-white">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" title="Mot de passe" className="text-xs">Mot de passe</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-12 text-base shadow-lg shadow-primary/20">
                  {submitting ? "Connexion..." : "Se connecter"}
                </Button>
                
                <div className="text-center mt-2">
                  <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="text-primary/70 hover:text-primary text-xs">
                        Mot de passe oublié ?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md">
                      <DialogHeader>
                        <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1">
                          <Label htmlFor="reset-email">Votre Email</Label>
                          <Input 
                            id="reset-email" 
                            type="email" 
                            placeholder="email@example.com"
                            value={resetEmail} 
                            onChange={(e) => setResetEmail(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="reset-code">Code d'invitation (MUMS...)</Label>
                          <Input 
                            id="reset-code" 
                            placeholder="Code requis pour réinitialiser"
                            value={resetCode} 
                            onChange={(e) => setResetCode(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="new-password">Nouveau mot de passe</Label>
                          <Input 
                            id="new-password" 
                            type="password" 
                            placeholder="6 caractères min."
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={async () => {
                            if (!resetEmail || !resetCode || !newPassword) {
                              toast.error("Veuillez remplir tous les champs");
                              return;
                            }
                            setIsResetting(true);
                            try {
                              await resetPassword(resetEmail, resetCode, newPassword);
                              toast.success("Mot de passe mis à jour !");
                              setShowResetDialog(false);
                              setResetCode("");
                              setNewPassword("");
                            } catch (err: any) {
                              toast.error(err.message);
                            } finally {
                              setIsResetting(false);
                            }
                          }}
                          disabled={isResetting}
                          className="w-full"
                        >
                          {isResetting ? "Mise à jour..." : "Confirmer le changement"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs">Nom complet</Label>
                  <Input 
                    id="name" 
                    required 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-xs">Email</Label>
                  <Input 
                    id="signup-email" 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password" title="Mot de passe" className="text-xs">Mot de passe</Label>
                  <Input 
                    id="signup-password" 
                    type="password" 
                    minLength={6} 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invite-code" className="text-xs">Code d'invitation</Label>
                  <Input 
                    id="invite-code" 
                    required 
                    placeholder="Demandez-le à l'administrateur"
                    value={inviteCode} 
                    onChange={(e) => setInviteCode(e.target.value)} 
                    className="bg-white/50 border-white/30"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-12 text-base shadow-lg shadow-primary/20">
                  {submitting ? "Création..." : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 pt-6 border-t border-white/20 text-center">
            <p className="text-xs text-muted-foreground/60">
              © {new Date().getFullYear()} Mums'Home POS · Local-first Architecture
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
