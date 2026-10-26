/** Caricamento · Swipe: lo schermo nero dei Reel con una copertina che si accende. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="fixed inset-x-0 top-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[35] grid place-items-center bg-black lg:relative lg:inset-auto lg:z-auto lg:mx-auto lg:h-[calc(100dvh-72px-6rem)] lg:max-w-[440px] lg:rounded-[36px]"
    >
      <span className="sr-only">Caricamento…</span>
      <span aria-hidden className="skel dark size-[min(68vw,300px)] rounded-[36px]" />
    </div>
  );
}
