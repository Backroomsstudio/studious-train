import { redirect } from "next/navigation";
import { AuthForms } from "@/components/beats/auth/auth-forms";
import { ChromeButton, ChromeLink } from "@/components/beats/ui/chrome-button";
import { launchLabel, storeOpen } from "@/lib/beats/launch";
import { availableProviders, signIn } from "@/lib/beats/server/auth";
import { storeEnv } from "@/lib/beats/server/env";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Accedi" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ nuovo?: string; invito?: string }> }) {
  if (await getViewer()) redirect("/beats");
  const { nuovo, invito } = await searchParams;
  const invite = invito && /^[A-Z0-9]{3,16}$/.test(invito) ? invito : undefined;
  const providers = availableProviders();
  const google = providers.some((p) => p.id === "google");
  const magicLink = providers.some((p) => p.id === "resend");
  const launchAt = storeEnv.launchAt;
  const open = storeOpen(launchAt);

  async function withGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/beats" });
  }

  async function withEmail(formData: FormData) {
    "use server";
    await signIn("resend", { email: String(formData.get("email") ?? ""), redirectTo: "/beats" });
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="glass rounded-[32px] p-6 sm:p-8">
        <p className="text-[11px] font-semibold text-electric">Backrooms · Beat Store</p>
        <h1 className="chrome-text mt-2 font-display text-4xl font-semibold tracking-tight">Il tuo studio, il tuo nome</h1>
        <p className="mt-2 text-sm text-chrome-500">
          {open
            ? "Entra con la tua password personale: crediti, licenze e progetti ti aspettano."
            : `Il negozio apre il ${launchLabel(launchAt!)}. Fino ad allora qui entrano i producer dello studio: per registrarti serve il codice staff.`}
        </p>

        <div className="mt-6">
          {storeEnv.demoMode ? (
            <div className="rounded-2xl bg-chrome-100 p-4 text-sm text-chrome-500">
              Modalità demo: sei già collegato come utente dimostrativo. Con il database configurato qui compaiono accesso e
              registrazione con password.
              <ChromeLink href="/beats" variant="obsidian" className="mt-4 w-full">
                Torna al negozio
              </ChromeLink>
            </div>
          ) : (
            <AuthForms initialMode={nuovo || invite ? "signup" : "login"} invite={open ? invite : undefined} staffOnly={!open} />
          )}
        </div>

        {(google || magicLink) && (
          <div className="mt-6 space-y-4 border-t border-chrome-200 pt-6">
            <p className="text-center text-xs font-semibold text-chrome-400">oppure</p>
            {google && (
              <form action={withGoogle}>
                <ChromeButton type="submit" variant="chrome" size="lg" className="w-full normal-case tracking-normal">
                  Continua con Google
                </ChromeButton>
              </form>
            )}
            {magicLink && (
              <form action={withEmail} className="flex gap-2">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-label="Email per il link di accesso"
                  placeholder="Link di accesso via email"
                  className="glass h-12 min-w-0 flex-1 rounded-2xl px-4 text-[15px] outline-none"
                />
                <ChromeButton type="submit" variant="obsidian">
                  Invia
                </ChromeButton>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
