export type CoffeeEntry = {
  /** id único (uuid) */
  id: string;
  /** timestamp em milissegundos (epoch) */
  ts: number;
  /** quem registrou (opcional) */
  who?: string;
  /** observação livre (opcional) */
  note?: string;
};

/** Nota de 1 (ruim) a 5 (ótimo) dada a uma xícara. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

export const RATING_LABELS: Record<Rating, string> = {
  1: "ruim",
  2: "fraco",
  3: "ok",
  4: "bom",
  5: "ótimo",
};

export function isRating(value: unknown): value is Rating {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Uma xícara tomada por alguém. Diferente de `CoffeeEntry` (a *feita*, quando o
 * café foi passado), a xícara registra o **consumo** e, opcionalmente, a nota
 * do café daquele momento.
 */
export type CupEntry = {
  id: string;
  ts: number;
  /** quem tomou */
  who?: string;
  /** feita de onde a xícara saiu (a última registrada antes de `ts`) */
  brewId?: string;
  /** como estava o café (1–5) */
  rating?: Rating;
  note?: string;
};

export type StorageKind = "redis" | "file" | "none";

export type EntriesResponse = {
  storage: StorageKind;
  entries: CoffeeEntry[];
  /** presente quando a consulta pede `?cups=1` */
  cups?: CupEntry[];
};

export type CupsResponse = {
  storage: StorageKind;
  cups: CupEntry[];
};
