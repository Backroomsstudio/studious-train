import { SkeletonCards, SkeletonHeading, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Kit e preset: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading lines={2} />
      <SkeletonCards count={6} />
    </SkeletonPage>
  );
}
