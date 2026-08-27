import type { ReactNode } from "react";

/**
 * Sekcja informacyjna w ozdobnej ramie assetu Statistics-bkg.png.
 *
 * Trzy warstwy: pergamin (`__surface`, wcięty do otworu ramy — stąd
 * `paper-wash` siedzi TUTAJ, a nie na Panelu, bo nieprzezroczyste tło Panelu
 * malowałoby prostokąt wystający spod ornamentu), 9-slice ramy (`__art`) i
 * treść (`__body`). Obie warstwy dekoracyjne mają `pointer-events: none`,
 * więc cała interakcja treści (linki, formularze, przyciski) działa bez
 * zmian.
 *
 * Panel opakowujący musi dostać klasę `section-frame`, która oddaje mu własne
 * tło, promień i obrys. Padding sekcji przechodzi z Panelu na
 * `.section-frame__body`, bo musi być liczony z szerokości pasa ramy, a nie
 * ze stałej skali Tailwinda — dlatego opakowany Panel nie nosi już `p-*`.
 *
 * Geometria assetu i uzasadnienie techniki: `.section-frame` w globals.css.
 */
export function SectionFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="section-frame__surface paper-wash" />
      <span aria-hidden="true" className="section-frame__art" />
      <div className="section-frame__body">{children}</div>
    </>
  );
}
