import { Skeleton, SkeletonPage, SkeletonRows } from "@/components/beats/ui/skeleton";

/** Caricamento · Pagina del beat: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-8">
      <Skeleton w={90} h={14} className="rounded-md" />
      <div aria-hidden className="glass grid gap-6 rounded-[32px] p-6 sm:p-8 lg:grid-cols-[auto_1fr]">
        <Skeleton className="size-36 rounded-[28px]" />
        <div className="grid min-w-0 content-start gap-4">
          <Skeleton w="min(380px, 70%)" h={52} className="rounded-xl" />
          <Skeleton w="35%" h={14} className="rounded-md" />
          <Skeleton h={64} className="w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={58} className="rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton w={220} h={22} className="rounded-lg" />
        <SkeletonRows count={4} />
      </div>
    </SkeletonPage>
  );
}
