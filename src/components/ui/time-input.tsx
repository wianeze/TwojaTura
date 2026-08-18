import type { InputHTMLAttributes } from "react";

type TimeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "step"
>;

/**
 * Wspólne pole godziny. Natywny `type=time` otwiera systemowy picker na
 * telefonie, a przeglądarka przekazuje do FormData niezmiennie `HH:mm`.
 * Minuty pozostają dowolne — krok 60 oznacza jedną minutę, nie kwadrans.
 */
export function TimeInput({ className = "", ...props }: TimeInputProps) {
  return (
    <input
      {...props}
      type="time"
      step={60}
      className={`min-w-0 max-w-full ${className}`}
    />
  );
}
