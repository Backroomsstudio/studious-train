import { Skeleton, SkeletonCards, SkeletonHeading, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Studio: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <SkeletonHeading lines={2} />
        <Skeleton h={120} className="w-full rounded-[28px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 1, 0, 0, 0, 1].map((dark, i) => (
          <div key={i} aria-hidden className={dark ? "obsidian flex items-center gap-4 rounded-[24px] p-4" : "glass flex items-center gap-4 rounded-[24px] p-4"}>
            <Skeleton dark={dark === 1} className="size-12 shrink-0 rounded-2xl" />
            <span className="grid flex-1 gap-2">
              <Skeleton dark={dark === 1} w="55%" h={14} className="rounded-md" />
              <Skeleton dark={dark === 1} w="70%" h={10} className="rounded-md" />
            </span>
          </div>
        ))}
      </div>
      <SkeletonCards count={3} media={false} />
    </SkeletonPage>
  );
}
