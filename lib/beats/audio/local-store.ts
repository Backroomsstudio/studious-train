/**
 * Archivio locale dello studio in app (IndexedDB, solo nel browser): progetti di registrazione
 * e ultimo render della demo, che il Master A/B può riprendere. Le voci degli artisti non
 * lasciano il dispositivo finché non decidono loro di esportarle o mandarle allo studio.
 * Se IndexedDB non è disponibile (navigazione privata, Safari vecchi) si ripiega sulla memoria.
 */
const DB_NAME = "backrooms-studio";
const VERSION = 1;
export type LocalStoreName = "projects" | "renders";

/** Audio serializzabile: canali Float32 (IndexedDB li salva così come sono). */
export interface StoredAudio {
  name: string;
  sampleRate: number;
  channels: Float32Array[];
  createdAt: string;
}

/** Chiave del render che lo studio lascia al Master A/B. */
export const LAST_DEMO_KEY = "last-demo";

const memory: Record<LocalStoreName, Map<string, unknown>> = { projects: new Map(), renders: new Map() };
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        for (const name of ["projects", "renders"] as const) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(store: LocalStoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return resolve(undefined);
        try {
          const request = fn(db.transaction(store, mode).objectStore(store));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => reject(request.error);
        } catch (error) {
          reject(error);
        }
      }),
  );
}

export async function localPut<T>(store: LocalStoreName, key: string, value: T): Promise<void> {
  memory[store].set(key, value);
  await run(store, "readwrite", (s) => s.put(value, key)).catch(() => undefined);
}

export async function localGet<T>(store: LocalStoreName, key: string): Promise<T | undefined> {
  const stored = await run<T>(store, "readonly", (s) => s.get(key)).catch(() => undefined);
  return stored ?? (memory[store].get(key) as T | undefined);
}

export async function localDelete(store: LocalStoreName, key: string): Promise<void> {
  memory[store].delete(key);
  await run(store, "readwrite", (s) => s.delete(key)).catch(() => undefined);
}

export async function localAll<T>(store: LocalStoreName): Promise<T[]> {
  const stored = await run<T[]>(store, "readonly", (s) => s.getAll()).catch(() => undefined);
  return stored ?? ([...memory[store].values()] as T[]);
}
