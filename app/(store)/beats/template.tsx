import { PageTransition } from "@/components/beats/experience/page-transition";

/** Template (si rimonta a ogni navigazione): transizione a molla tra le sezioni del negozio. */
export default function BeatsTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
