import { Skeleton, SkeletonPage, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento · Asta: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-4">
      <Skeleton w={110} h={14} className="rounded-md" />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <SkeletonStage minHeight={360}>
          <div className="flex items-center gap-4">
            <Skeleton dark className="size-20 shrink-0 rounded-2xl" />
            <span className="grid flex-1 gap-2">
              <Skeleton dark w={90} h={10} className="rounded-md" />
              <Skeleton dark w="60%" h={28} className="rounded-lg" />
            </span>
          </div>
          <Skeleton dark w="50%" h={52} className="mt-6 rounded-xl" />
          <Skeleton dark h={56} className="mt-2 w-full rounded-full" />
        </SkeletonStage>
        <div aria-hidden className="glass grid content-start gap-3 rounded-[32px] p-6">
          <Skeleton w="40%" h={18} className="rounded-md" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={44} className="w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
