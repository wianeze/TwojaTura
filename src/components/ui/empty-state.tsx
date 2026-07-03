import Image from "next/image";

const emptyStateContent = {
  shelf: {
    src: "/empty/empty-shelf.png",
    alt: "Pusta drewniana półka czekająca na planszówki",
    eyebrow: "Półka czeka",
    title: "Postaw tu pierwsze pudełko",
    description:
      "Dodane gry pojawią się na tej półce jako część Twojej kolekcji.",
  },
  meetings: {
    src: "/empty/empty-meetings.png",
    alt: "Pusty stół przygotowany na spotkanie planszówkowe",
    eyebrow: "Stół jest wolny",
    title: "Zaplanuj pierwszy wieczór",
    description:
      "Nowe spotkania i ankiety dostępności pojawią się właśnie tutaj.",
  },
  chronicle: {
    src: "/empty/empty-chronicle.png",
    alt: "Otwarta, jeszcze pusta kronika partii",
    eyebrow: "Pierwsza strona",
    title: "Kronika czeka na wpis",
    description:
      "Po rozegranej partii zapiszesz tu grę, uczestników i zwycięzcę.",
  },
} as const;

type EmptyStateProps = {
  variant: keyof typeof emptyStateContent;
};

export function EmptyState({ variant }: EmptyStateProps) {
  const content = emptyStateContent[variant];

  return (
    <section className="shadow-warm relative isolate min-h-[25rem] overflow-hidden rounded-[2rem] border border-white/10">
      <Image
        src={content.src}
        alt={content.alt}
        fill
        sizes="(max-width: 1024px) 100vw, 70vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(25,14,10,0.88),rgba(25,14,10,0.5)_58%,rgba(25,14,10,0.18))]" />
      <div className="text-cream flex min-h-[25rem] max-w-lg flex-col justify-end p-6 sm:p-9">
        <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#e4b36d] uppercase">
          {content.eyebrow}
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold">
          {content.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#d4c5b4]">
          {content.description}
        </p>
      </div>
    </section>
  );
}
