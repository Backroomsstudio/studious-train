import { Skeleton, SkeletonPage, SkeletonRows } from "@/components/beats/ui/skeleton";

/** Caricamento · Cerca: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-4">
      <Skeleton w={160} h={40} className="rounded-xl" />
      <Skeleton h={52} className="w-full rounded-full" />
      <div aria-hidden className="flex gap-2 overflow-hidden">
        {[88, 72, 96, 64, 80, 70].map((w, i) => (
          <Skeleton key={i} w={w} h={36} className="shrink-0 rounded-full" />
        ))}
      </div>
      <SkeletonRows count={7} />
    </SkeletonPage>
  );
}
