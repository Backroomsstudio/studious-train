import { Skeleton, SkeletonHeading, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Swipe: la pila di carte. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading />
      <Skeleton dark h={460} className="mx-auto w-full max-w-sm rounded-[32px]" />
    </SkeletonPage>
  );
}
