import { KineticText, Reveal } from "@/components/Reveal";
import { playlistUrl } from "@/lib/content";

interface Embed {
  provider: "Spotify" | "Apple Music" | "SoundCloud";
  src: string;
  height: number;
}

/** Converte il link di condivisione della playlist nell'URL del player ufficiale del provider. */
function toEmbed(url: string): Embed | null {
  const value = url.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.hostname.endsWith("spotify.com")) {
      const match = u.pathname.match(/(playlist|album|artist|track)\/([A-Za-z0-9]+)/);
      return match ? { provider: "Spotify", src: `https://open.spotify.com/embed/${match[1]}/${match[2]}?theme=0`, height: 452 } : null;
    }
    if (u.hostname.endsWith("music.apple.com")) {
      return { provider: "Apple Music", src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: 520 };
    }
    if (u.hostname.endsWith("soundcloud.com")) {
      return {
        provider: "SoundCloud",
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(value)}&color=%23ffffff&visual=false&show_comments=false`,
        height: 520,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Playlist ufficiale con le tracce reali del collettivo. Non viene mostrata finché il link non è configurato. */
export function Playlist() {
  const embed = toEmbed(playlistUrl);
  if (!embed) return null;

  return (
    <section id="ascolta" aria-labelledby="ascolta-title" className="relative py-20 sm:py-32">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow">Ascolta le nostre produzioni</p>
          <KineticText id="ascolta-title" text="Il suono *parla da solo*." className="mt-5 text-[clamp(2.5rem,6.5vw,5.5rem)]" />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-mist">
              Le tracce reali prodotte, registrate e mixate dal collettivo. Premi play e ascolta cosa esce dalla Lounge.
            </p>
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
            >
              Apri su {embed.provider} ↗
            </a>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="chrome-border overflow-hidden rounded-[1.75rem] bg-titanium p-2">
            <iframe
              title={`Playlist ufficiale Backrooms Studio su ${embed.provider}`}
              src={embed.src}
              width="100%"
              height={embed.height}
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="block rounded-[1.4rem] border-0"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
