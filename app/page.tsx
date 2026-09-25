import { AudioPlayer } from "@/components/AudioPlayer";
import { Calculator } from "@/components/Calculator";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Hero3D } from "@/components/Hero3D";
import { LocalProof } from "@/components/LocalProof";
import { Navbar } from "@/components/Navbar";
import { Reviews } from "@/components/Reviews";
import { Services } from "@/components/Services";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <Hero3D />
        <LocalProof />
        <AudioPlayer />
        <Services />
        <Calculator />
        <Reviews />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
