import { Mail } from "lucide-react";
import { redirect } from "next/navigation";
import { ChromeButton, ChromeLink } from "@/components/beats/ui/chrome-button";
import { availableProviders, signIn } from "@/lib/beats/server/auth";
import { storeEnv } from "@/lib/beats/server/env";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Accedi" };

export default async function SignInPage() {
  if (await getViewer()) redirect("/beats");
  const providers = availableProviders();

  async function withGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/beats" });
  }

  async function withEmail(formData: FormData) {
    "use server";
    await signIn("resend", { email: String(formData.get("email") ?? ""), redirectTo: "/beats" });
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="glass rounded-[32px] p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Backrooms · Beat Store</p>
        <h1 className="chrome-text mt-2 font-display text-4xl font-black tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-chrome-500">Il tuo saldo crediti, le licenze e i download ti aspettano.</p>

        <div className="mt-6 space-y-3">
          {providers.some((p) => p.id === "google") && (
            <form action={withGoogle}>
              <ChromeButton type="submit" variant="chrome" size="lg" className="w-full normal-case tracking-normal">
                Continua con Google
              </ChromeButton>
            </form>
          )}
          {providers.some((p) => p.id === "resend") && (
            <form action={withEmail} className="space-y-2">
              <label className="glass flex h-12 items-center gap-3 rounded-full px-4">
                <Mail className="size-4 text-chrome-400" aria-hidden />
                <span className="sr-only">Email</span>
                <input name="email" type="email" required autoComplete="email" placeholder="la-tua@email.it" className="flex-1 bg-transparent outline-none" />
              </label>
              <ChromeButton type="submit" variant="electric" size="lg" className="w-full">
                Ricevi il link di accesso
              </ChromeButton>
            </form>
          )}
          {!providers.length && (
            <div className="rounded-2xl bg-chrome-100 p-4 text-sm text-chrome-500">
              {storeEnv.demoMode
                ? "Modalità demo: sei già collegato come utente dimostrativo."
                : "Nessun metodo di accesso configurato: imposta AUTH_GOOGLE_ID/SECRET o AUTH_RESEND_KEY."}
              <ChromeLink href="/beats" variant="obsidian" className="mt-3 w-full">
                Torna al negozio
              </ChromeLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
