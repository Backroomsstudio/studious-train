"use client";

import { Check, Download, Package, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { PRODUCT_KINDS, type PaidWith, type ProductKind } from "@/lib/beats/offers";
import type { ProductSummary } from "@/lib/beats/types";
import { usePurchase, useViewer } from "../providers";
import { Chip } from "../ui/chip";
import { PayChoice } from "./pay-choice";

/** Un solo lettore per le demo dei kit: farne partire una ferma l'altra. */
let demoAudio: HTMLAudioElement | null = null;
const demoListeners = new Set<(id: string | null) => void>();

function playDemo(id: string | null) {
  demoAudio ??= new Audio();
  demoAudio.pause();
  if (id) {
    demoAudio.src = `/api/products/${encodeURIComponent(id)}/preview`;
    demoAudio.onended = () => demoListeners.forEach((l) => l(null));
    void demoAudio.play().catch(() => demoListeners.forEach((l) => l(null)));
  }
  demoListeners.forEach((l) => l(id));
}

function useDemo() {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    demoListeners.add(setCurrent);
    return () => {
      demoListeners.delete(setCurrent);
      if (!demoListeners.size) demoAudio?.pause();
    };
  }, []);
  return current;
}

function ProductCard({ product }: { product: ProductSummary }) {
  const demo = useDemo();
  const playing = demo === product.id;
  const { data: viewer } = useViewer();
  const purchase = usePurchase();
  const [method, setMethod] = useState<PaidWith | null>(null);
  const done = purchase.data?.kind === "done";
  const owned = product.owned || done;

  return (
    <article className="glass flex flex-col overflow-hidden rounded-[26px]">
      <div className="chrome-pink relative grid h-36 place-items-center overflow-hidden">
        {product.hasPreview ? (
          <button
            type="button"
            onClick={() => playDemo(playing ? null : product.id)}
            aria-label={playing ? `Pausa demo di ${product.title}` : `Ascolta la demo di ${product.title}`}
            className="grid size-16 place-items-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 translate-x-px fill-current" />}
          </button>
        ) : (
          <Package className="size-12 text-white/85" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-2 text-[10px] font-semibold text-white backdrop-blur">
          {PRODUCT_KINDS[product.kind]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-semibold leading-tight">{product.title}</h3>
        {product.producer && (
          <p className="mt-0 text-[13px] font-normal text-chrome-500">
            di <span style={{ color: product.producer.accentColor ?? undefined }}>{product.producer.name}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-chrome-500">{product.description}</p>
        <ul className="mt-4 flex-1 space-y-2 text-[13px]">
          {product.contents.map((c) => (
            <li key={c} className="flex gap-2">
              <Check className="mt-0 size-3.5 shrink-0 text-electric" /> {c}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          {owned ? (
            <a
              href={`/api/products/${encodeURIComponent(product.id)}/download`}
              download
              className="chrome-surface inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-graphite"
            >
              <Download className="size-4 text-electric" /> Scarica
            </a>
          ) : (
            <PayChoice
              credits={product.credits}
              priceCents={product.priceCents}
              balance={viewer?.creditBalance ?? null}
              pending={purchase.isPending ? method : null}
              label="Prendi"
              onPay={(paidWith) => {
                setMethod(paidWith);
                purchase.mutate({ url: `/api/products/${encodeURIComponent(product.id)}/buy`, body: { paidWith } }, { onSettled: () => setMethod(null) });
              }}
            />
          )}
          {purchase.data?.kind === "done" && <p className="mt-2 text-center text-xs font-semibold text-ok">{purchase.data.message}</p>}
          {purchase.error && (
            <p role="alert" className="mt-2 text-center text-xs text-deal">
              {purchase.error.message}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  const [kind, setKind] = useState<ProductKind | null>(null);
  const shown = kind ? products.filter((p) => p.kind === kind) : products;
  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="group" aria-label="Tipo di prodotto">
        <Chip active={!kind} onClick={() => setKind(null)}>
          Tutto
        </Chip>
        {(Object.keys(PRODUCT_KINDS) as ProductKind[]).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {PRODUCT_KINDS[k]}
          </Chip>
        ))}
      </div>
      {shown.length ? (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="glass rounded-[28px] p-6 text-center">
          <p className="font-semibold">In arrivo</p>
          <p className="mt-2 text-sm text-chrome-500">I primi kit escono a breve: torna a trovarci.</p>
        </div>
      )}
    </div>
  );
}
