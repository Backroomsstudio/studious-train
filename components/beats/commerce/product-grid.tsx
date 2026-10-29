"use client";

import { Check, Download, Package } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PRODUCT_KINDS, type PaidWith, type ProductKind } from "@/lib/beats/offers";
import type { ProductSummary } from "@/lib/beats/types";
import { usePurchase, useViewer } from "../providers";
import { Chip } from "../ui/chip";
import { PayChoice } from "./pay-choice";

function ProductCard({ product }: { product: ProductSummary }) {
  const { data: viewer } = useViewer();
  const purchase = usePurchase();
  const [method, setMethod] = useState<PaidWith | null>(null);
  const done = purchase.data?.kind === "done";
  const owned = product.owned || done;

  return (
    <article className="glass flex flex-col overflow-hidden rounded-[26px]">
      <div className="chrome-pink relative grid h-36 place-items-center overflow-hidden">
        <Package className="size-12 text-white/85" />
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
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
