"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PRODUCT_KINDS, type ProductKind } from "@/lib/beats/offers";
import type { ProductInput, StaffProducer, StaffProduct } from "@/lib/beats/staff";
import { feedback } from "@/lib/beats/ui-feedback";
import { api, ApiRequestError } from "../providers";
import { ChromeButton } from "../ui/chrome-button";
import { Section, Segmented, SelectField, TextArea, TextField, Toggle } from "./fields";
import { SlotRow, useUploads } from "./file-slots";
import { newDraftId } from "./upload";

const KIND_OPTIONS = (Object.keys(PRODUCT_KINDS) as ProductKind[]).map((k) => ({ value: k, label: PRODUCT_KINDS[k] }));

const euros = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");
const toCents = (value: string) => Math.round(Number(value.replace(",", ".") || 0) * 100);

export function ProductEditor({
  product,
  producers,
  viewerProducer,
  onSaved,
}: {
  product?: StaffProduct;
  producers: StaffProducer[];
  viewerProducer: string | null;
  onSaved: (product: StaffProduct) => void;
}) {
  const [draftId] = useState(newDraftId);
  const uploads = useUploads(draftId, { "product-zip": product?.files.zip, "product-preview": product?.files.preview });
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "LOOP_KIT");
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [contents, setContents] = useState((product?.contents ?? []).join("\n"));
  const [producerSlug, setProducer] = useState<string>(product ? (product.producerSlug ?? "") : (viewerProducer ?? ""));
  const [price, setPrice] = useState(euros(product?.priceCents ?? 0));
  const [credits, setCredits] = useState(product ? String(product.credits) : "");
  // La copertina dei kit è sempre il cromato nero-rosa del sito: il colore resta quello salvato.
  const coverColor = product?.coverColor ?? "#e0306c";
  const [published, setPublished] = useState(product?.published ?? false);
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});

  const save = async () => {
    setState({ pending: true });
    const body: ProductInput = {
      kind,
      title,
      description,
      contents: contents
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8),
      producerSlug: producerSlug || null,
      priceCents: toCents(price),
      credits: Number(credits || 0),
      coverColor,
      published,
      files: { zip: uploads.keyOf("product-zip"), preview: uploads.keyOf("product-preview") || null },
    };
    try {
      const res = product
        ? await api<{ product: StaffProduct }>(`/api/staff/products/${encodeURIComponent(product.id)}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<{ product: StaffProduct }>("/api/staff/products", { method: "POST", body: JSON.stringify(body) });
      feedback(published ? "unlock" : "pop");
      setState({});
      onSaved(res.product);
    } catch (error) {
      feedback("error");
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };

  return (
    <div className="space-y-6">
      <Section title="File" hint="Un unico ZIP con tutto il kit. La demo d'ascolto è facoltativa ma vende molto di più.">
        <div className="space-y-2">
          <SlotRow slot="product-zip" state={uploads.get("product-zip")} onFile={(f) => uploads.start("product-zip", f)} hint="ZIP con loop, sample o preset" />
          <SlotRow
            slot="product-preview"
            state={uploads.get("product-preview")}
            onFile={(f) => uploads.start("product-preview", f)}
            hint="MP3 di 30-60 secondi con i suoni del kit"
          />
        </div>
      </Section>

      <Section title="Il kit">
        <Segmented label="Tipo" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <TextField label="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <TextArea label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        <TextArea
          label="Contenuto, una riga per voce (es. 25 loop melodici, 140-160 BPM)"
          value={contents}
          onChange={(e) => setContents(e.target.value)}
          rows={4}
        />
        <SelectField label="Firmato da" value={producerSlug} onChange={(e) => setProducer(e.target.value)}>
          <option value="">Backrooms Studio</option>
          {producers.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </Section>

      <Section title="Prezzo" hint="Si può comprare con la carta, con i crediti o in entrambi i modi.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prezzo in euro" inputMode="decimal" placeholder="Es. 19,90" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} />
          <TextField label="Prezzo in crediti" inputMode="numeric" placeholder="Es. 4" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
        <Toggle label="In vendita" text="Visibile nella pagina Kit (dal lancio per il pubblico)" checked={published} onChange={setPublished} />
      </Section>

      {state.error && (
        <p role="alert" className="rounded-2xl bg-deal/10 px-4 py-4 text-sm text-deal">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-[calc(-1.25rem-env(safe-area-inset-bottom))] -mx-6 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-chrome-200 bg-white px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pb-8">
        <ChromeButton
          variant={published ? "electric" : "obsidian"}
          size="lg"
          className="w-full"
          disabled={state.pending || uploads.busy || !title.trim() || !description.trim()}
          onClick={save}
        >
          {state.pending ? <Loader2 className="size-4 animate-spin" /> : uploads.busy ? "Attendi la fine dei caricamenti" : published ? "Metti in vendita" : "Salva bozza"}
        </ChromeButton>
      </div>
    </div>
  );
}
