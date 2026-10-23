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

export type StorageKind = "redis" | "file" | "none";

export type EntriesResponse = {
  storage: StorageKind;
  entries: CoffeeEntry[];
};
