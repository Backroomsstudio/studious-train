import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BeatHero } from "@/components/beats/marketplace/beat-hero";
import { TrackList } from "@/components/beats/marketplace/track-row";
import { StemMixerButton } from "@/components/beats/mixer/stem-mixer";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { GlowBadge, ProducerTag } from "@/components/beats/ui/glow-badge";
import { formatTime } from "@/lib/beats/format";
import { camelotCode, keyName } from "@/lib/beats/music";
import { getBackend } from "@/lib/beats/server/backend";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const beat = await (await getBackend()).beatBySlug((await params).slug);
  if (!beat) return { title: "Beat non trovato" };
  const by = beat.producers.map((p) => p.name).join(" & ");
  return {
    title: `${beat.title} · prod. ${by}`,
    description: `${beat.title}, ${beat.bpm} BPM in ${keyName(beat.key)}. ${beat.genres.map((g) => g.name).join(", ")} prodotto da ${by}.`,
  };
}

export default async function BeatPage({ params }: Props) {
  const backend = await getBackend();
  const beat = await backend.beatBySlug((await params).slug);
  if (!beat) notFound();
  const similar = await backend.similar(beat);

  const facts = [
    ["BPM", String(beat.bpm)],
    ["Tonalità", `${keyName(beat.key)} · ${camelotCode(beat.key)}`],
    ["Durata", formatTime(beat.durationSec)],
    ["Stems", beat.hasStems ? "Disponibili" : "No"],
  ];

  return (
    <div className="space-y-8">
      <Link href="/beats" className="inline-flex items-center gap-1.5 text-sm font-semibold text-chrome-500 hover:text-graphite">
        <ArrowLeft className="size-4" /> Catalogo
      </Link>

      <section className="glass grid gap-6 rounded-[32px] p-5 sm:p-7 lg:grid-cols-[auto_1fr]" aria-labelledby="beat-title">
        <BeatCover beat={beat} size="xl" />
        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {beat.isCollab && <GlowBadge tone="electric">Co-produzione</GlowBadge>}
              {beat.deal && <GlowBadge tone="deal">Beat del giorno -{beat.deal.discountPct}%</GlowBadge>}
            </div>
            <h1 id="beat-title" className="chrome-text mt-2 font-display text-5xl font-black tracking-tight">
              {beat.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4">
              {beat.producers.map((p) => (
                <ProducerTag key={p.slug} name={p.name} color={p.accentColor} co={p.role === "CO_PRODUCER"} />
              ))}
            </div>
          </div>
          <BeatHero beat={beat} />
          {beat.hasStems && (
            <div className="flex flex-wrap items-center gap-3">
              <StemMixerButton beat={beat} />
              <p className="text-sm text-chrome-500">Batteria, 808, accordi e FX separati: prova il beat parte per parte.</p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="chrome-surface rounded-2xl px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-chrome-500">{label}</dt>
                <dd className="mt-0.5 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {[...beat.genres.map((g) => g.name), ...beat.typeTags.map((t) => `${t.name} Type`), ...beat.moods].map((tag) => (
              <span key={tag} className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-graphite-700">
                {tag}
              </span>
            ))}
          </div>
          {beat.description && <p className="max-w-2xl text-[15px] leading-relaxed text-chrome-500">{beat.description}</p>}
        </div>
      </section>

      {similar.length > 0 && (
        <section aria-labelledby="simili-title" className="space-y-2">
          <h2 id="simili-title" className="font-display text-xl font-bold">
            In armonia con {beat.title}
          </h2>
          <p className="text-sm text-chrome-500">Tonalità compatibili sulla ruota Camelot e BPM vicini: perfetti per un medley o un remix.</p>
          <TrackList beats={similar} />
        </section>
      )}
    </div>
  );
}
