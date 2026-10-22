import Link from "next/link";
import { notFound } from "next/navigation";
import { AuctionRoom } from "@/components/beats/commerce/auction-room";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await (await getBackend()).auction(id, null);
  return { title: auction ? `Asta · ${auction.beat.title}` : "Asta" };
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const auction = await (await getBackend()).auction(id, viewer?.id ?? null);
  if (!auction) notFound();
  return (
    <div className="space-y-4">
      <Link href="/beats/aste" className="text-sm font-semibold text-electric">
        ← Tutte le aste
      </Link>
      <AuctionRoom initial={auction} />
    </div>
  );
}
