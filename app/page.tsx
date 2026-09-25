import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Gallery } from "@/components/Gallery";
import { Hero3D } from "@/components/Hero3D";
import { InTheBox } from "@/components/InTheBox";
import { LiveStreaming } from "@/components/LiveStreaming";
import { Lounge } from "@/components/Lounge";
import { Navbar } from "@/components/Navbar";
import { Playlist } from "@/components/Playlist";
import { Reviews } from "@/components/Reviews";
import { Services } from "@/components/Services";
import { TailorMade } from "@/components/TailorMade";

/**
 * Architettura della landing (mobile-first):
 * Hero → Studio Lounge Experience → Foto → Servizi → Tecnologia ITB → Pacchetti Tailor-Made
 * → Live Streaming → Playlist (se configurata) → Testimonianze (se presenti) → FAQ → Footer
 */
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <Hero3D />
        <Lounge />
        <Gallery />
        <Services />
        <InTheBox />
        <TailorMade />
        <LiveStreaming />
        <Playlist />
        <Reviews />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
