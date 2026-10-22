import { Skeleton, SkeletonCards, SkeletonHeading, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Cerco feat: filtri e annunci. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading lines={2} />
      <div aria-hidden className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} w={96} h={36} className="rounded-full" />
        ))}
      </div>
      <SkeletonCards count={6} media={false} />
    </SkeletonPage>
  );
}
