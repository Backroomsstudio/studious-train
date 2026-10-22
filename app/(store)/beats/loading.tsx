import { Skeleton, SkeletonPage, SkeletonRows, SkeletonShelf, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Home del negozio: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-2xl sm:size-[72px]" />
        <div className="grid min-w-0 flex-1 gap-2.5">
          <Skeleton w={150} h={10} className="rounded-md" />
          <Skeleton w="min(360px, 80%)" h={44} className="rounded-xl" />
          <Skeleton w="min(300px, 66%)" h={12} className="rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="glass grid content-start gap-3 rounded-[28px] p-5">
          <Skeleton w="38%" h={10} className="rounded-md" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 shrink-0 rounded-2xl" />
            <span className="grid flex-1 gap-2">
              <Skeleton w="60%" h={16} className="rounded-md" />
              <Skeleton w="40%" h={11} className="rounded-md" />
              <Skeleton h={8} className="mt-1 w-full rounded-full" />
            </span>
          </div>
        </div>
        <SkeletonStage minHeight={240} />
      </div>
      <SkeletonShelf />
      <div className="space-y-3">
        <Skeleton w={150} h={26} className="rounded-lg" />
        <SkeletonRows count={6} />
      </div>
    </SkeletonPage>
  );
}
