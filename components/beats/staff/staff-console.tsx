"use client";

import { Pause, Pencil, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { keyName } from "@/lib/beats/music";
import { formatEuro } from "@/lib/beats/plans";
import { PRODUCT_KINDS } from "@/lib/beats/offers";
import { beatVisibility, type ProducerInput, type StaffBeat, type StaffProducer, type StaffProduct } from "@/lib/beats/staff";
import { feedback } from "@/lib/beats/ui-feedback";
import { api, ApiRequestError } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { Chip } from "../ui/chip";
import { ChromeButton } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { BeatEditor } from "./beat-editor";
import { Section, Swatches, TextArea, TextField } from "./fields";
import { ProductEditor } from "./product-editor";

type Genre = { slug: string; name: string; parent: string | null };

const DATE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const VISIBILITY = {
  draft: { label: "Bozza", className: "bg-chrome-100 text-chrome-500" },
  live: { label: "Online", className: "bg-ok/10 text-ok" },
  scheduled: { label: "Programmato", className: "bg-electric-50 text-electric" },
  archived: { label: "Archiviato", className: "bg-chrome-100 text-chrome-400" },
} as const;

/** Un solo lettore per le anteprime dello staff (anche bozze e uscite programmate). */
function usePreviewPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (id: string, kind: "beat" | "product") => {
    audio.current ??= new Audio();
    const el = audio.current;
    if (playing === id) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = `/api/staff/preview?kind=${kind}&id=${encodeURIComponent(id)}`;
    el.onended = () => setPlaying(null);
    el.onerror = () => setPlaying(null);
    void el.play().catch(() => setPlaying(null));
    setPlaying(id);
  };
  return { playing, toggle };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-[24px] px-4 py-4">
      <p className="font-display text-3xl font-semibold tabular-nums text-graphite">{value}</p>
      <p className="mt-2 text-[13px] text-chrome-500">{label}</p>
    </div>
  );
}

function ProducerForm({ producer, onSaved }: { producer: StaffProducer; onSaved: (p: StaffProducer) => void }) {
  const [form, setForm] = useState<ProducerInput>({ name: producer.name, bio: producer.bio, instagram: producer.instagram, accentColor: producer.accentColor });
  const [state, setState] = useState<{ pending?: boolean; ok?: boolean; error?: string }>({});
  const save = async () => {
    setState({ pending: true });
    try {
      const res = await api<{ producer: StaffProducer }>("/api/staff/producer", { method: "PATCH", body: JSON.stringify(form) });
      feedback("pop");
      setState({ ok: true });
      onSaved(res.producer);
    } catch (error) {
      feedback("error");
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };
  return (
    <div className="glass space-y-6 rounded-[28px] p-6">
      <Section title="Il tuo profilo producer" hint="Nome, bio e colore compaiono sui tuoi beat, nei filtri di Cerca e nella tua pagina.">
        <TextField label="Nome d'arte" value={form.name} maxLength={32} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextArea label="Bio" value={form.bio} maxLength={400} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        <TextField
          label="Instagram (solo il nome utente)"
          value={form.instagram}
          maxLength={30}
          onChange={(e) => setForm({ ...form, instagram: e.target.value.replace(/^@/, "") })}
        />
        <Swatches label="Colore dei tuoi tag" value={form.accentColor} onChange={(accentColor) => setForm({ ...form, accentColor })} />
      </Section>
      {state.error && (
        <p role="alert" className="text-sm text-deal">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm font-semibold text-ok">Profilo salvato.</p>}
      <ChromeButton variant="obsidian" size="lg" className="w-full" disabled={state.pending} onClick={save}>
        Salva il profilo
      </ChromeButton>
    </div>
  );
}

function StorageCheck() {
  const [state, setState] = useState<{ pending?: boolean; message?: string; error?: string }>({});
  const run = async () => {
    setState({ pending: true });
    try {
      const res = await api<{ message: string }>("/api/staff/storage", { method: "POST" });
      setState({ message: res.message });
    } catch (error) {
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };
  return (
    <div className="glass space-y-4 rounded-[28px] p-6">
      <Section title="Archivio file" hint="Se un caricamento si ferma subito con un errore di rete, prepara l'archivio una volta: abilita i caricamenti da questo sito.">
        <ChromeButton variant="chrome" disabled={state.pending} onClick={run}>
          Prepara l&apos;archivio per i caricamenti
        </ChromeButton>
        {state.message && <p className="text-sm font-semibold text-ok">{state.message}</p>}
        {state.error && (
          <p role="alert" className="text-sm text-deal">
            {state.error}
          </p>
        )}
      </Section>
    </div>
  );
}

export function StaffConsole({
  initialBeats,
  initialProducts,
  initialProducers,
  genres,
  viewerProducer,
  launch,
  waitlist,
  members,
}: {
  initialBeats: StaffBeat[];
  initialProducts: StaffProduct[];
  initialProducers: StaffProducer[];
  genres: Genre[];
  viewerProducer: string | null;
  launch: { at: string; label: string; open: boolean } | null;
  waitlist: number;
  members: number;
}) {
  const [tab, setTab] = useState<"beat" | "kit" | "profilo">("beat");
  const [beats, setBeats] = useState(initialBeats);
  const [products, setProducts] = useState(initialProducts);
  const [producers, setProducers] = useState(initialProducers);
  const [editing, setEditing] = useState<{ kind: "beat"; beat?: StaffBeat } | { kind: "kit"; product?: StaffProduct } | null>(null);
  const preview = usePreviewPlayer();
  const [now] = useState(() => new Date());

  const counts = beats.reduce(
    (acc, b) => {
      acc[beatVisibility(b, now)]++;
      return acc;
    },
    { draft: 0, live: 0, scheduled: 0, archived: 0 },
  );
  // Nuovi beat: escono subito se il negozio è aperto, altrimenti il giorno del lancio.
  const defaultRelease = launch && !launch.open ? launch.at : new Date().toISOString();
  const mine = producers.find((p) => p.slug === viewerProducer);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[13px] text-electric">Area producer</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Gestione</h1>
          <p className="mt-2 text-[15px] text-chrome-500">
            {launch && !launch.open
              ? `Carica beat e kit: il pubblico li vede dal ${launch.label}. Fino ad allora il negozio è solo vostro.`
              : "Carica beat e kit: con una data futura escono da soli."}
          </p>
        </div>
        {launch && !launch.open && (
          <Link href="/beats/presto" className="text-sm font-semibold text-graphite-700 underline">
            Vedi la pagina d&apos;attesa
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Beat online" value={counts.live} />
        <Stat label="Programmati" value={counts.scheduled} />
        <Stat label="Bozze" value={counts.draft} />
        <Stat label={launch && !launch.open ? "In lista d'attesa" : "Artisti iscritti"} value={launch && !launch.open ? waitlist : members} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2" role="tablist" aria-label="Sezioni della Gestione">
          {(
            [
              ["beat", `Beat ${beats.length}`],
              ["kit", `Kit ${products.length}`],
              ["profilo", "Profilo"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} role="tab" aria-selected={tab === id} aria-pressed={undefined} active={tab === id} onClick={() => setTab(id)}>
              {label}
            </Chip>
          ))}
        </div>
        {tab !== "profilo" && (
          <ChromeButton variant="electric" onClick={() => setEditing(tab === "beat" ? { kind: "beat" } : { kind: "kit" })}>
            <Plus className="size-4" /> {tab === "beat" ? "Nuovo beat" : "Nuovo kit"}
          </ChromeButton>
        )}
      </div>

      {tab === "beat" &&
        (beats.length ? (
          <ul className="space-y-2" aria-label="Beat">
            {beats.map((b) => {
              const vis = VISIBILITY[beatVisibility(b, now)];
              return (
                <li key={b.id} className="glass flex items-center gap-4 rounded-[22px] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => preview.toggle(b.id, "beat")}
                    disabled={!b.files.preview}
                    aria-label={preview.playing === b.id ? `Pausa ${b.title}` : `Ascolta ${b.title}`}
                    className="relative shrink-0 rounded-xl disabled:opacity-60"
                  >
                    <BeatCover
                      size="sm"
                      beat={{ id: b.id, title: b.title, coverUrl: null, producers: b.producers, bpm: b.bpm, key: { root: b.keyRoot, mode: b.keyMode }, peaks: b.peaks }}
                    />
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-graphite/40 text-white">
                      {preview.playing === b.id ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{b.title}</span>
                      <span className={cn("rounded-full px-2 py-0 text-[12px] font-semibold", vis.className)}>
                        {vis.label}
                        {beatVisibility(b, now) === "scheduled" && ` · ${DATE.format(new Date(b.releasedAt))}`}
                      </span>
                    </div>
                    <p className="mt-0 truncate text-[13px] text-chrome-500">
                      {b.producers.map((p) => p.name).join(", ")} · {b.bpm} BPM · {keyName({ root: b.keyRoot, mode: b.keyMode })}
                      {b.playCount > 0 && ` · ${b.playCount} ascolti`}
                      {b.licenseCount > 0 && ` · ${b.licenseCount} licenze`}
                    </p>
                  </div>
                  <ChromeButton variant="ghost" size="icon" aria-label={`Modifica ${b.title}`} onClick={() => setEditing({ kind: "beat", beat: b })}>
                    <Pencil className="size-4" />
                  </ChromeButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="glass rounded-[28px] p-6 text-center">
            <p className="font-semibold">Ancora nessun beat</p>
            <p className="mt-2 text-sm text-chrome-500">Tocca Nuovo beat e trascina i file: anteprima con tag, MP3, WAV e stems.</p>
          </div>
        ))}

      {tab === "kit" &&
        (products.length ? (
          <ul className="space-y-2" aria-label="Kit">
            {products.map((p) => (
              <li key={p.id} className="glass flex items-center gap-4 rounded-[22px] px-4 py-2">
                <button
                  type="button"
                  onClick={() => preview.toggle(p.id, "product")}
                  disabled={!p.files.preview}
                  aria-label={preview.playing === p.id ? `Pausa ${p.title}` : `Ascolta ${p.title}`}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-60"
                  style={{ background: p.coverColor }}
                >
                  {preview.playing === p.id ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{p.title}</span>
                    <span className={cn("rounded-full px-2 py-0 text-[12px] font-semibold", p.published ? VISIBILITY.live.className : VISIBILITY.draft.className)}>
                      {p.published ? "In vendita" : "Bozza"}
                    </span>
                  </div>
                  <p className="mt-0 truncate text-[13px] text-chrome-500">
                    {PRODUCT_KINDS[p.kind]}
                    {p.priceCents > 0 && ` · ${formatEuro(p.priceCents)}`}
                    {p.credits > 0 && ` · ${p.credits} crediti`}
                    {p.purchaseCount > 0 && ` · ${p.purchaseCount} vendite`}
                  </p>
                </div>
                <ChromeButton variant="ghost" size="icon" aria-label={`Modifica ${p.title}`} onClick={() => setEditing({ kind: "kit", product: p })}>
                  <Pencil className="size-4" />
                </ChromeButton>
              </li>
            ))}
          </ul>
        ) : (
          <div className="glass rounded-[28px] p-6 text-center">
            <p className="font-semibold">Ancora nessun kit</p>
            <p className="mt-2 text-sm text-chrome-500">Loop kit, sample kit, drum kit e preset: un ZIP, una demo d&apos;ascolto e il prezzo.</p>
          </div>
        ))}

      {tab === "profilo" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {mine ? (
            <ProducerForm producer={mine} onSaved={(p) => setProducers((all) => all.map((x) => (x.slug === p.slug ? p : x)))} />
          ) : (
            <div className="glass rounded-[28px] p-6 text-sm text-chrome-500">Questo account non è collegato a un profilo producer.</div>
          )}
          <StorageCheck />
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.kind === "kit" ? (editing.product ? "Modifica kit" : "Nuovo kit") : editing?.beat ? "Modifica beat" : "Nuovo beat"}
        className="sm:w-[min(720px,calc(100vw-2rem))]"
      >
        {editing?.kind === "beat" && (
          <BeatEditor
            key={editing.beat?.id ?? "new"}
            beat={editing.beat}
            producers={producers}
            genres={genres}
            viewerProducer={viewerProducer}
            defaultRelease={defaultRelease}
            onSaved={(saved) => {
              setBeats((all) => [saved, ...all.filter((b) => b.id !== saved.id)]);
              setEditing(null);
            }}
          />
        )}
        {editing?.kind === "kit" && (
          <ProductEditor
            key={editing.product?.id ?? "new"}
            product={editing.product}
            producers={producers}
            viewerProducer={viewerProducer}
            onSaved={(saved) => {
              setProducts((all) => [saved, ...all.filter((p) => p.id !== saved.id)]);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
