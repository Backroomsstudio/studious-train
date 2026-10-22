import { Skeleton, SkeletonPage } from "@/components/beats/ui/skeleton";

/** Caricamento · Accesso: scheletro cromato con la stessa sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage className="mx-auto max-w-md py-4">
      <div aria-hidden className="glass grid gap-3 rounded-[32px] p-6 sm:p-8">
        <Skeleton w={150} h={10} className="rounded-md" />
        <Skeleton w="85%" h={40} className="rounded-xl" />
        <Skeleton w="70%" h={12} className="rounded-md" />
        <Skeleton h={48} className="mt-4 w-full rounded-2xl" />
        <Skeleton h={48} className="w-full rounded-2xl" />
        <Skeleton h={56} className="mt-2 w-full rounded-full" />
      </div>
    </SkeletonPage>
  );
}
