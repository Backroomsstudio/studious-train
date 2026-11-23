/**
 * Pop-up di conferma: il cliente vede subito che il posto è suo, con il riepilogo dell'ordine.
 * Usato dopo una prenotazione in contanti (sulla pagina /prenota/) e al ritorno da Stripe (/prenota/confermata/).
 */
import type { OrderRecap } from "../booking/order.ts";
import { studio } from "../booking/studio.ts";

type Child = Node | string | null | false | undefined;

function h(tag: string, attrs: Record<string, string | boolean | ((e: Event) => void) | undefined> = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** File .ics con gli appuntamenti, da aggiungere al calendario del telefono. */
function icsFile(r: OrderRecap): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const where = `${studio.address.street}, ${studio.address.postalCode} ${studio.address.city} (${studio.address.province})`;
  const events = r.appuntamenti.map((a, i) =>
    [
      "BEGIN:VEVENT",
      `UID:${stamp(a.inizio)}-${i}@backroomsstudio.it`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(a.inizio)}`,
      `DTEND:${stamp(a.fine)}`,
      `SUMMARY:${esc(`Backrooms Studio · ${a.titolo}`)}`,
      `LOCATION:${esc(where)}`,
      `DESCRIPTION:${esc(`${r.titolo}. Totale ${r.totale}${r.pagamento === "contanti" ? " da saldare in contanti al primo appuntamento" : ", pagato online"}. WhatsApp ${studio.phone}`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Sessione da Backrooms Studio",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Backrooms Studio//Prenotazioni//IT", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

function downloadIcs(r: OrderRecap) {
  const blob = new Blob([icsFile(r)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: "backrooms-studio-prenotazione.ics" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function texts(r: OrderRecap) {
  if (r.stato === "pagato")
    return {
      eyebrow: "Pagamento ricevuto",
      title: r.appuntamenti.length ? "Il posto è tuo!" : "Ordine confermato!",
      lead: r.appuntamenti.length
        ? `Grazie ${r.nome}: abbiamo riservato ${r.appuntamenti.length > 1 ? "i tuoi appuntamenti" : "il tuo orario"} in studio. Ti arriva anche un'email con il riepilogo e la ricevuta.`
        : `Grazie ${r.nome}: il pagamento è andato a buon fine. Ti scriviamo noi per ricevere il materiale.`,
    };
  if (r.stato === "in-attesa")
    return {
      eyebrow: "Pagamento in verifica",
      title: "Ci siamo quasi",
      lead: `${r.nome}, il pagamento è in elaborazione: appena va a buon fine il posto è confermato e ti arriva l'email.`,
    };
  return {
    eyebrow: "Prenotazione registrata",
    title: "Il posto è tuo!",
    lead: `Grazie ${r.nome}: ${r.appuntamenti.length > 1 ? "i tuoi appuntamenti sono riservati" : "il tuo orario è riservato"}. Porta i contanti al ${r.appuntamenti.length > 1 ? "primo appuntamento" : "giorno della sessione"}.`,
  };
}

export function showRecap(r: OrderRecap, onClose?: () => void): HTMLDialogElement {
  const t = texts(r);
  const close = () => {
    dlg.close();
  };
  const dlg = h(
    "dialog",
    { class: "book bk-ok", "aria-labelledby": "bk-ok-title" },
    h(
      "div",
      { class: "slab" },
      h(
        "div",
        { class: "face" },
        h("button", { class: "x", type: "button", "aria-label": "Chiudi", onclick: close }, "✕"),
        h(
          "div",
          { class: "bk-ok-badge" + (r.stato === "in-attesa" ? " wait" : ""), "aria-hidden": "true" },
          h("span", {}, r.stato === "in-attesa" ? "…" : "✓"),
        ),
        h("div", { class: "eyebrow" }, t.eyebrow),
        h("h2", { id: "bk-ok-title", class: "gold-text t3d" }, t.title),
        h("p", { class: "bk-ok-lead" }, t.lead),
        r.appuntamenti.length
          ? h(
              "ol",
              { class: "bk-ok-appts" },
              r.appuntamenti.map((a, i) => h("li", {}, h("i", {}, String(i + 1)), h("span", {}, h("b", {}, cap(a.quando)), h("small", {}, a.titolo)))),
            )
          : null,
        h(
          "div",
          { class: "bk-ok-order" },
          h("p", { class: "bk-ok-name" }, r.titolo),
          h("ul", {}, r.righe.map((x) => h("li", {}, x))),
          r.aDistanza.length ? h("p", { class: "bk-ok-note" }, `A distanza (ti scriviamo noi per il materiale): ${r.aDistanza.join(", ")}.`) : null,
          h(
            "div",
            { class: "bk-ok-total" },
            h("span", {}, r.pagamento === "contanti" ? "Da saldare in studio" : r.stato === "pagato" ? "Pagato" : "Totale"),
            h("b", { class: "gold-text" }, `${r.totale}${r.mensile ? "/mese" : ""}`),
          ),
          r.regola ? h("p", { class: "bk-ok-note" }, "Puoi spostare o annullare avvisandoci almeno 24 ore prima.") : null,
        ),
        h(
          "div",
          { class: "bk-ok-acts" },
          r.appuntamenti.length && r.stato !== "in-attesa"
            ? h("button", { type: "button", class: "btn", onclick: () => downloadIcs(r) }, "Aggiungi al calendario")
            : null,
          h("a", { class: "btn-ghost", href: `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(`Ciao ${studio.name}! Sono ${r.nome}, ho appena prenotato dal sito: ${r.titolo}.`)}`, target: "_blank", rel: "noopener" }, "Scrivici su WhatsApp"),
          h("a", { class: "bk-link", href: "/" }, "Torna al sito"),
        ),
        h("p", { class: "bk-ok-addr" }, `Ci trovi in ${studio.address.street}, ${studio.address.city} (${studio.address.province})`),
      ),
    ),
  ) as HTMLDialogElement;
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener("close", () => {
    onClose?.();
    dlg.remove();
  });
  document.body.append(dlg);
  if (dlg.showModal) dlg.showModal();
  else dlg.setAttribute("open", "");
  return dlg;
}
