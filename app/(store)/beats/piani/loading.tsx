import { Skeleton, SkeletonCards, SkeletonHeading, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Piani: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-8">
      <SkeletonHeading lines={3} />
      <Skeleton w={220} h={44} className="mx-auto rounded-full" />
      <div aria-hidden className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={i === 1 ? "obsidian grid gap-3 rounded-[28px] p-6" : "glass grid gap-3 rounded-[28px] p-6"}>
            <Skeleton dark={i === 1} w="45%" h={20} className="rounded-md" />
            <Skeleton dark={i === 1} w="60%" h={38} className="rounded-xl" />
            <Skeleton dark={i === 1} w="70%" h={12} className="rounded-md" />
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} dark={i === 1} w={`${70 + ((i + j) % 3) * 9}%`} h={11} className="rounded-md" />
            ))}
            <Skeleton dark={i === 1} h={48} className="mt-3 w-full rounded-full" />
          </div>
        ))}
      </div>
      <SkeletonCards count={3} media={false} />
    </SkeletonPage>
  );
}
