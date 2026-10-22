export const STORE_ERRORS = {
  UNAUTHENTICATED: { status: 401, message: "Accedi per continuare." },
  INSUFFICIENT_CREDITS: { status: 402, message: "Crediti insufficienti per questa licenza." },
  PLAN_REQUIRED: { status: 403, message: "Questa licenza richiede un piano superiore." },
  LICENSE_REVOKED: { status: 403, message: "Questa licenza è stata revocata." },
  INVALID_GRANT: { status: 403, message: "Link di download scaduto o non valido." },
  NOT_FOUND: { status: 404, message: "Risorsa non trovata." },
  BAD_REQUEST: { status: 400, message: "Richiesta non valida." },
  NOT_CONFIGURED: { status: 503, message: "Servizio non ancora configurato." },
  FORBIDDEN: { status: 403, message: "Non puoi farlo con questo account." },
  RATE_LIMITED: { status: 429, message: "Stai andando troppo veloce: riprova tra poco." },
} as const;

export type StoreErrorCode = keyof typeof STORE_ERRORS;

export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message?: string,
  ) {
    super(message ?? STORE_ERRORS[code].message);
    this.name = "StoreError";
  }

  get status(): number {
    return STORE_ERRORS[this.code].status;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof StoreError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("[beats]", error);
  return Response.json({ error: { code: "INTERNAL", message: "Errore imprevisto, riprova." } }, { status: 500 });
}
