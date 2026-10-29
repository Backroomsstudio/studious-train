import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Aste: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-8">
      <SkeletonHeading lines={2} />
      <div className="space-y-4">
        <Skeleton w={110} h={22} className="rounded-lg" />
        <SkeletonStage minHeight={150}>
          <div className="flex items-center gap-4">
            <Skeleton dark className="size-20 shrink-0 rounded-2xl" />
            <span className="grid flex-1 gap-2">
              <Skeleton dark w={90} h={10} className="rounded-md" />
              <Skeleton dark w="55%" h={22} className="rounded-lg" />
              <Skeleton dark w="35%" h={12} className="rounded-md" />
            </span>
          </div>
        </SkeletonStage>
      </div>
      <div className="space-y-4">
        <Skeleton w={110} h={22} className="rounded-lg" />
        {[0, 1].map((i) => (
          <div key={i} aria-hidden className="glass flex items-center gap-4 rounded-[26px] p-4">
            <Skeleton className="size-14 shrink-0 rounded-2xl" />
            <span className="grid flex-1 gap-2">
              <Skeleton w={80} h={10} className="rounded-md" />
              <Skeleton w="45%" h={16} className="rounded-md" />
            </span>
            <Skeleton w={72} h={30} className="rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
