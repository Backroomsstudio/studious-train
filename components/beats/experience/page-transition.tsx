"use client";

import { motion, MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SPRING_SOFT } from "@/lib/beats/motion";

/**
 * Entrata di ogni pagina: sale e si mette a fuoco con una molla morbida. Con "riduci movimento"
 * MotionConfig salta i movimenti (stesso markup sul server e nel browser: niente errori di idratazione).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  // Lo Swipe è un livello fisso a schermo intero: un antenato trasformato lo sposterebbe.
  const fullscreen = usePathname().startsWith("/beats/swipe");
  return (
    <MotionConfig reducedMotion="user">
      {fullscreen ? (
        children
      ) : (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
          {children}
        </motion.div>
      )}
    </MotionConfig>
  );
}
