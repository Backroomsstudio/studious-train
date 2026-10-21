import { LandingPage, landingMetadata } from "@/components/LandingPage";
import { getLandingPage } from "@/lib/landing-pages";

const page = getLandingPage("mix-e-master-vicenza");

export const metadata = landingMetadata(page);

export default function Page() {
  return <LandingPage page={page} />;
}
