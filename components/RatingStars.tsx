"use client";

import { RATINGS, RATING_LABELS, type Rating } from "@/lib/types";
import { StarIcon } from "./Icons";

type Props = {
  value: Rating | null | undefined;
  /** quando presente, as estrelas viram botões; clicar na nota atual limpa */
  onChange?: (rating: Rating | null) => void;
  size?: number;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
};

/**
 * Cinco estrelas, só leitura ou interativas. Usa `currentColor` para as
 * estrelas cheias e um tom apagado para as vazias, então a cor vem de quem
 * usa o componente.
 */
export default function RatingStars({
  value,
  onChange,
  size = 16,
  disabled = false,
  showLabel = false,
  className = "",
}: Props) {
  const current = value ?? 0;
  const interactive = typeof onChange === "function" && !disabled;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Nota do café" : value ? `Nota ${value} de 5` : "Sem nota"}
    >
      <span className="inline-flex items-center gap-0.5">
        {RATINGS.map((rating) => {
          const filled = rating <= current;
          const star = (
            <StarIcon
              size={size}
              filled={filled}
              className={filled ? "text-amber-500" : "text-latte"}
            />
          );
          if (!interactive) {
            return <span key={rating}>{star}</span>;
          }
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={value === rating}
              aria-label={`${rating} — ${RATING_LABELS[rating]}`}
              title={`${rating} — ${RATING_LABELS[rating]}`}
              onClick={() => onChange?.(value === rating ? null : rating)}
              className="rounded-md p-0.5 transition hover:scale-110 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
            >
              {star}
            </button>
          );
        })}
      </span>
      {showLabel ? (
        <span className="text-[11px] text-muted">
          {value ? RATING_LABELS[value] : interactive ? "avaliar" : ""}
        </span>
      ) : null}
    </span>
  );
}
