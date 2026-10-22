import { SkeletonCards, SkeletonHeading, SkeletonPage, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Master A/B: palco con forma d'onda e scelta della sorgente. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading lines={2} />
      <SkeletonStage minHeight={320} />
      <SkeletonCards count={3} media={false} />
    </SkeletonPage>
  );
}
