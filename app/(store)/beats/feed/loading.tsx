import { Skeleton, SkeletonPage, SkeletonRows, SkeletonShelf } from "@/components/beats/ui/skeleton";

/** Caricamento · Feed: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-10">
      <div className="grid gap-2.5">
        <Skeleton w={60} h={10} className="rounded-md" />
        <Skeleton w="min(340px, 75%)" h={40} className="rounded-xl" />
      </div>
      <SkeletonShelf />
      <div className="space-y-3">
        <Skeleton w={240} h={22} className="rounded-lg" />
        <Skeleton w={120} h={18} className="rounded-md" />
        <SkeletonRows count={4} />
      </div>
      <div className="space-y-3">
        <Skeleton w={180} h={22} className="rounded-lg" />
        <SkeletonRows count={3} />
      </div>
    </SkeletonPage>
  );
}
