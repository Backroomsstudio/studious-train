import { Skeleton, SkeletonPage, SkeletonRows, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Libreria: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-6">
      <div className="grid gap-2.5">
        <Skeleton w={90} h={10} className="rounded-md" />
        <Skeleton w="min(380px, 78%)" h={52} className="rounded-xl" />
      </div>
      <SkeletonStage minHeight={170}>
        <Skeleton dark w={120} h={10} className="rounded-md" />
        <Skeleton dark w="45%" h={40} className="rounded-xl" />
        <Skeleton dark w="65%" h={12} className="rounded-md" />
      </SkeletonStage>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton h={140} className="w-full rounded-[28px]" />
        <Skeleton h={140} className="w-full rounded-[28px]" />
      </div>
      <div className="space-y-3">
        <Skeleton w={170} h={22} className="rounded-lg" />
        <SkeletonRows count={4} />
      </div>
    </SkeletonPage>
  );
}
