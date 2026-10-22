import { SkeletonHeading, SkeletonPage, SkeletonRows, SkeletonStage } from "@/components/beats/ui/skeleton";

/** Caricamento: palco scuro e righe, con la sagoma della pagina. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading lines={2} />
      <SkeletonStage minHeight={300} />
      <SkeletonRows count={4} />
    </SkeletonPage>
  );
}
