/**
 * Stems su richiesta: chi compra una licenza con gli stems li chiede in chat (WhatsApp dello studio)
 * citando il codice della licenza, che lo staff ritrova nella Gestione.
 */
import { whatsappLink } from "../studio";

/** Codice breve della licenza, da citare in chat (ultimi 8 caratteri dell'id). */
export const licenseCode = (licenseId: string) => licenseId.slice(-8).toUpperCase();

export function stemsRequestLink(beatTitle: string, licenseName: string, licenseId: string): string | null {
  return whatsappLink(
    `Ciao Backrooms! Ho la licenza ${licenseName} di "${beatTitle}" (codice ${licenseCode(licenseId)}): mi mandate gli stems?`,
  );
}
