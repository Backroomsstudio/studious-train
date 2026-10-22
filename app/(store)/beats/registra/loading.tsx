import { Skeleton, SkeletonCards, SkeletonHeading, SkeletonPage, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Registra: il palco nero dello studio, i preset e le tracce. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading lines={2} />
      <SkeletonStage minHeight={380} />
      <SkeletonCards count={3} media={false} />
      <Skeleton h={220} className="w-full rounded-[28px]" />
    </SkeletonPage>
  );
}
