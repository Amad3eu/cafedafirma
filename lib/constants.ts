export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Repositório público do projeto (código, issues e releases). */
export const REPO_URL = "https://github.com/Amad3eu/cafedafirma";

/** Página de política de privacidade publicada junto do site. */
export const PRIVACY_PATH = "/privacidade";

/**
 * Janela máxima para associar uma xícara à feita anterior. Depois disso o café
 * já esfriou: a xícara fica sem `brewId` e não entra nas notas da feita.
 */
export const BREW_MAX_AGE = 12 * HOUR;

/** Quantas avaliações alguém precisa ter para entrar no ranking de barista. */
export const MIN_RATINGS_FOR_RANKING = 3;
