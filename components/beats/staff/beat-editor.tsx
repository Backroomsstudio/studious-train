"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { NOTE_NAMES } from "@/lib/beats/music";
import {
  evenSplits,
  formatOf,
  guessFromFilename,
  stemSlot,
  type BeatInput,
  type StaffBeat,
  type StaffProducer,
  type UploadSlot,
} from "@/lib/beats/staff";
import { STEM_INFO, STEM_NAMES } from "@/lib/beats/stems";
import { feedback } from "@/lib/beats/ui-feedback";
import { Waveform } from "../player/waveform";
import { api, ApiRequestError } from "../providers";
import { Chip } from "../ui/chip";
import { ChromeButton } from "../ui/chrome-button";
import { fromLocalInput, Section, Segmented, SelectField, TagInput, TextArea, TextField, toLocalInput, Toggle } from "./fields";
import { DropZone, SlotRow, useUploads } from "./file-slots";
import { analyzeAudio, newDraftId } from "./upload";

type Genre = { slug: string; name: string; parent: string | null };

/** Dove va un file trascinato insieme agli altri: dal formato e dal nome. */
function slotForFile(file: File, taken: (slot: UploadSlot) => boolean): UploadSlot | null {
  const format = formatOf(file.name);
  const name = file.name.toLowerCase();
  if (format === "wav") return "wav";
  if (format === "zip") return "stems";
  if (format !== "mp3") return null;
  if (/drum|batteria|perc/.test(name)) return stemSlot("drums");
  if (/bass|808/.test(name)) return stemSlot("bass");
  if (/keys|chord|accordi|melod/.test(name)) return stemSlot("keys");
  if (/\bfx\b|_fx|-fx|effetti/.test(name)) return stemSlot("fx");
  if (/tag|preview|anteprima/.test(name)) return "preview";
  return taken("mp3") ? "preview" : "mp3";
}

export function BeatEditor({
  beat,
  producers,
  genres,
  viewerProducer,
  defaultRelease,
  onSaved,
}: {
  beat?: StaffBeat;
  producers: StaffProducer[];
  genres: Genre[];
  viewerProducer: string | null;
  defaultRelease: string;
  onSaved: (beat: StaffBeat) => void;
}) {
  const [draftId] = useState(newDraftId);
  const uploads = useUploads(draftId, {
    preview: beat?.files.preview,
    mp3: beat?.files.mp3,
    wav: beat?.files.wav,
    stems: beat?.files.stems,
    ...(beat?.files.stemPreviewPrefix ? Object.fromEntries(STEM_NAMES.map((s) => [stemSlot(s), `${beat.files.stemPreviewPrefix}/${s}.mp3`])) : {}),
  });

  const [title, setTitle] = useState(beat?.title ?? "");
  const [description, setDescription] = useState(beat?.description ?? "");
  const [bpm, setBpm] = useState(beat ? String(beat.bpm) : "");
  const [keyRoot, setKeyRoot] = useState(beat?.keyRoot ?? 0);
  const [keyMode, setKeyMode] = useState<"MAJOR" | "MINOR">(beat?.keyMode ?? "MINOR");
  const [durationSec, setDuration] = useState(beat?.durationSec ?? 0);
  const [peaks, setPeaks] = useState<number[]>(beat?.peaks ?? []);
  const [picked, setPicked] = useState<string[]>(beat?.genres ?? []);
  const [typeTags, setTypeTags] = useState<string[]>(beat?.typeTags ?? []);
  const [moods, setMoods] = useState<string[]>(beat?.moods ?? []);
  const [team, setTeam] = useState<BeatInput["producers"]>(
    beat?.producers.map(({ slug, role, splitPct }) => ({ slug, role, splitPct })) ??
      (viewerProducer ? [{ slug: viewerProducer, role: "MAIN", splitPct: 100 }] : []),
  );
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(beat?.status ?? "DRAFT");
  const [releasedAt, setReleasedAt] = useState(toLocalInput(beat?.releasedAt ?? defaultRelease));
  const [exclusive, setExclusive] = useState(beat?.exclusiveAvailable ?? true);
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});
  const [analyzing, setAnalyzing] = useState(false);

  const rootGenres = useMemo(() => genres.filter((g) => !g.parent), [genres]);
  const subGenres = useMemo(() => genres.filter((g) => g.parent), [genres]);
  const splitTotal = team.reduce((sum, p) => sum + p.splitPct, 0);

  const handleFile = async (slot: UploadSlot, file: File) => {
    const guess = guessFromFilename(file.name);
    if (guess.bpm) setBpm((current) => current || String(guess.bpm));
    if (!beat && guess.keyRoot !== undefined) {
      setKeyRoot(guess.keyRoot);
      if (guess.keyMode) setKeyMode(guess.keyMode);
    }
    if (slot === "wav" || slot === "mp3" || slot === "preview") {
      const fromName = file.name
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/\d{2,3}\s?bpm/i, "")
          .replace(/[_-]+/g, " ")
          .replace(/\b(tag|preview|anteprima|master)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
      setTitle((current) => current || fromName);
    }
    if (slot === "preview") {
      setAnalyzing(true);
      analyzeAudio(file)
        .then((a) => {
          setDuration(a.durationSec);
          setPeaks(a.peaks);
        })
        .catch(() => setState({ error: "Non riesco a leggere l'anteprima: è un MP3 valido?" }))
        .finally(() => setAnalyzing(false));
    }
    await uploads.start(slot, file);
  };

  const dropFiles = (files: File[]) => {
    const assigned = new Set<UploadSlot>();
    for (const file of files) {
      const slot = slotForFile(file, (s) => assigned.has(s) || Boolean(uploads.keyOf(s)));
      if (slot && !assigned.has(slot)) {
        assigned.add(slot);
        void handleFile(slot, file);
      }
    }
  };

  const toggleProducer = (slug: string) => {
    setTeam((current) => {
      const next = current.some((p) => p.slug === slug)
        ? current.filter((p) => p.slug !== slug)
        : [...current, { slug, role: current.length ? ("CO_PRODUCER" as const) : ("MAIN" as const), splitPct: 0 }];
      const splits = evenSplits(next.length);
      return next.map((p, i) => ({ ...p, splitPct: splits[i] }));
    });
  };

  const stemsComplete = STEM_NAMES.every((s) => uploads.keyOf(stemSlot(s)));
  const scheduled = new Date(fromLocalInput(releasedAt)).getTime() > Date.now();

  const save = async () => {
    setState({ pending: true });
    const stemKey = uploads.keyOf(stemSlot("drums"));
    const body: BeatInput = {
      title,
      description,
      bpm: Number(bpm),
      keyRoot,
      keyMode,
      durationSec,
      peaks,
      genres: picked,
      typeTags,
      moods,
      producers: team,
      status,
      releasedAt: fromLocalInput(releasedAt),
      exclusiveAvailable: exclusive,
      files: {
        preview: uploads.keyOf("preview"),
        mp3: uploads.keyOf("mp3"),
        wav: uploads.keyOf("wav"),
        stems: uploads.keyOf("stems") || null,
        // Le anteprime del mixer valgono solo tutte e quattro insieme, nella stessa cartella.
        stemPreviewPrefix: stemsComplete && stemKey ? stemKey.slice(0, stemKey.lastIndexOf("/")) : null,
      },
    };
    try {
      const res = beat
        ? await api<{ beat: StaffBeat }>(`/api/staff/beats/${encodeURIComponent(beat.id)}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<{ beat: StaffBeat }>("/api/staff/beats", { method: "POST", body: JSON.stringify(body) });
      feedback(status === "PUBLISHED" ? "unlock" : "pop");
      setState({});
      onSaved(res.beat);
    } catch (error) {
      feedback("error");
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };

  const saveLabel = status === "DRAFT" ? "Salva bozza" : status === "ARCHIVED" ? "Archivia" : scheduled ? "Programma l'uscita" : "Pubblica ora";

  return (
    <div className="space-y-6">
      <Section title="File" hint="Trascina insieme WAV, MP3, anteprima con tag e ZIP degli stems: ognuno va al suo posto. Il caricamento parte subito.">
        <DropZone onFiles={dropFiles} label="Trascina qui i file del beat" accept=".mp3,.wav,.zip,audio/mpeg,audio/wav,application/zip" />
        <div className="space-y-2">
          <SlotRow slot="preview" state={uploads.get("preview")} onFile={(f) => handleFile("preview", f)} hint="MP3 con il tag vocale: è l'unico file che si ascolta gratis" />
          <SlotRow slot="mp3" state={uploads.get("mp3")} onFile={(f) => handleFile("mp3", f)} hint="MP3 senza tag, per la licenza MP3" />
          <SlotRow slot="wav" state={uploads.get("wav")} onFile={(f) => handleFile("wav", f)} hint="WAV senza tag, per le licenze WAV e superiori" />
          <SlotRow slot="stems" state={uploads.get("stems")} onFile={(f) => handleFile("stems", f)} hint="Facoltativo: ZIP con le tracce separate" />
        </div>
        {(peaks.length > 0 || analyzing) && (
          <div className="rounded-2xl bg-chrome-50 px-4 py-4">
            <p className="mb-2 text-[13px] text-chrome-500">
              {analyzing ? "Leggo l'anteprima…" : `Forma d'onda dall'anteprima · ${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}`}
            </p>
            {peaks.length > 0 && <Waveform peaks={peaks} progress={0} height={40} compact label="Forma d'onda dell'anteprima" />}
          </div>
        )}
        {uploads.keyOf("stems") && (
          <details className="rounded-2xl" open={STEM_NAMES.some((s) => uploads.get(stemSlot(s)).status !== "empty")}>
            <summary className="cursor-pointer text-sm font-semibold text-graphite-700">Anteprime per il mixer (facoltative)</summary>
            <p className="mt-2 text-sm text-chrome-500">Quattro MP3 brevi con il tag: chi ascolta può alzare e abbassare le parti prima di comprare.</p>
            <div className="mt-4 space-y-2">
              {STEM_NAMES.map((s) => (
                <SlotRow key={s} slot={stemSlot(s)} state={uploads.get(stemSlot(s))} onFile={(f) => handleFile(stemSlot(s), f)} hint={STEM_INFO[s].label} />
              ))}
            </div>
          </details>
        )}
      </Section>

      <Section title="Il beat">
        <TextField label="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        <TextArea label="Descrizione (facoltativa)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="BPM" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          <SelectField label="Tonica" value={keyRoot} onChange={(e) => setKeyRoot(Number(e.target.value))}>
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </SelectField>
          <Segmented
            label="Modo"
            value={keyMode}
            options={[
              { value: "MINOR", label: "Minore" },
              { value: "MAJOR", label: "Maggiore" },
            ]}
            onChange={setKeyMode}
          />
        </div>
      </Section>

      <Section title="Generi e tag" hint="Fino a 4 generi. I type beat e i mood aiutano la ricerca.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Generi">
          {[...rootGenres, ...subGenres].map((g) => (
            <Chip
              key={g.slug}
              active={picked.includes(g.slug)}
              onClick={() => setPicked((p) => (p.includes(g.slug) ? p.filter((x) => x !== g.slug) : p.length < 4 ? [...p, g.slug] : p))}
            >
              {g.name}
            </Chip>
          ))}
        </div>
        <TagInput label="Type beat" values={typeTags} onChange={setTypeTags} max={6} placeholder="Es. Travis Scott, Sfera Ebbasta" />
        <TagInput label="Mood" values={moods} onChange={setMoods} max={6} placeholder="Es. dark, notturno" />
      </Section>

      <Section title="Produttori e quote" hint="Le quote dividono i ricavi del beat e devono fare 100.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Produttori">
          {producers.map((p) => (
            <Chip key={p.slug} active={team.some((t) => t.slug === p.slug)} accent={p.accentColor} onClick={() => toggleProducer(p.slug)}>
              {p.name}
            </Chip>
          ))}
        </div>
        {team.length > 0 && (
          <ul className="space-y-2">
            {team.map((member, i) => (
              <li key={member.slug} className="chrome-surface flex flex-wrap items-center gap-4 rounded-2xl px-4 py-2">
                <span className="min-w-24 flex-1 text-[15px] font-semibold">{producers.find((p) => p.slug === member.slug)?.name}</span>
                <select
                  aria-label="Ruolo"
                  value={member.role}
                  onChange={(e) =>
                    setTeam((t) => t.map((m, j) => (j === i ? { ...m, role: e.target.value as "MAIN" | "CO_PRODUCER" } : m)))
                  }
                  className="h-10 rounded-full bg-chrome-100 px-4 text-sm outline-none"
                >
                  <option value="MAIN">Principale</option>
                  <option value="CO_PRODUCER">Co-produttore</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-chrome-500">
                  <input
                    aria-label="Quota"
                    inputMode="numeric"
                    value={member.splitPct}
                    onChange={(e) => {
                      const pct = Math.min(100, Number(e.target.value.replace(/\D/g, "") || 0));
                      setTeam((t) => t.map((m, j) => (j === i ? { ...m, splitPct: pct } : m)));
                    }}
                    className="h-10 w-16 rounded-full bg-chrome-100 px-4 text-right text-[16px] tabular-nums outline-none"
                  />
                  %
                </label>
              </li>
            ))}
          </ul>
        )}
        {team.length > 0 && splitTotal !== 100 && (
          <p className="text-sm text-deal">
            Le quote fanno {splitTotal}, devono fare 100.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setTeam((t) => t.map((m, i) => ({ ...m, splitPct: evenSplits(t.length)[i] })))}
            >
              Dividi in parti uguali
            </button>
          </p>
        )}
      </Section>

      <Section title="Pubblicazione" hint="Con una data futura il beat resta nascosto ed esce da solo in quel momento.">
        <Segmented
          label="Stato"
          value={status}
          options={[
            { value: "DRAFT", label: "Bozza" },
            { value: "PUBLISHED", label: "Pubblicato" },
            ...(beat ? [{ value: "ARCHIVED" as const, label: "Archiviato" }] : []),
          ]}
          onChange={setStatus}
        />
        <TextField label="Data e ora di uscita" type="datetime-local" value={releasedAt} onChange={(e) => setReleasedAt(e.target.value)} />
        <Toggle label="Esclusiva in vendita" text="Si può comprare l'esclusiva (anche all'asta)" checked={exclusive} onChange={setExclusive} />
      </Section>

      {state.error && (
        <p role="alert" className="rounded-2xl bg-deal/10 px-4 py-4 text-sm text-deal">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-[calc(-1.25rem-env(safe-area-inset-bottom))] -mx-6 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-chrome-200 bg-white px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pb-8">
        <ChromeButton
          variant={status === "PUBLISHED" ? "electric" : "obsidian"}
          size="lg"
          className={cn("w-full")}
          disabled={state.pending || uploads.busy || analyzing || !title.trim() || !bpm || team.length === 0}
          onClick={save}
        >
          {state.pending ? <Loader2 className="size-4 animate-spin" /> : uploads.busy ? "Attendi la fine dei caricamenti" : saveLabel}
        </ChromeButton>
      </div>
    </div>
  );
}
