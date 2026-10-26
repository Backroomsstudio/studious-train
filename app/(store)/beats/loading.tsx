import { Skeleton, SkeletonPage, SkeletonRows, SkeletonShelf, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Home: la testata Level 0, la griglia delle zone e le novità. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonStage minHeight={230} className="rounded-[32px]" />
      <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:grid-rows-2">
        <Skeleton dark className="col-span-2 h-[9.5rem] rounded-[26px] lg:row-span-2 lg:h-auto" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={i === 4 ? "col-span-2 h-[9.5rem] rounded-[26px]" : "h-[9.5rem] rounded-[26px]"} />
        ))}
      </div>
      <SkeletonShelf />
      <div className="space-y-3">
        <Skeleton w={150} h={26} className="rounded-lg" />
        <SkeletonRows count={6} />
      </div>
    </SkeletonPage>
  );
}
