"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameCover } from "@/components/ui/game-cover";

export type CompactPickerOption = {
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
};

type PlayPickerProps = {
  name: string;
  label: string;
  placeholder: string;
  emptyLabel: string;
  options: CompactPickerOption[];
  defaultValue: string;
  error?: string;
  required?: boolean;
  allowClear?: boolean;
};

function findOption(options: CompactPickerOption[], selectedId: string) {
  return options.find((option) => option.id === selectedId) ?? null;
}

export function PlayPicker({
  name,
  label,
  placeholder,
  emptyLabel,
  options,
  defaultValue,
  error,
  required = false,
  allowClear = false,
}: PlayPickerProps) {
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selected = findOption(options, selectedId);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    if (!normalizedQuery) return options.slice(0, 8);

    return options
      .filter((option) =>
        `${option.title} ${option.subtitle ?? ""}`
          .toLocaleLowerCase("pl-PL")
          .includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [options, query]);

  return (
    <label className="block text-sm font-semibold text-[#503828]">
      {label}
      <div ref={wrapperRef} className="relative mt-1.5">
        <input
          name={name}
          type="hidden"
          value={selectedId}
          required={required}
        />

        {selected ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="paper-wash flex w-full items-center gap-3 rounded-xl border border-[#9a7657]/35 px-3 py-2 text-left shadow-sm transition hover:border-[#b48760]/45"
          >
            {selected.coverUrl !== undefined ? (
              <GameCover
                title={selected.title}
                coverUrl={selected.coverUrl}
                size="mini"
                className="w-14"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ead7b6] text-[0.65rem] font-bold text-[#6f523d] uppercase">
                •
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#4d3528]">
                {selected.title}
              </span>
              {selected.subtitle ? (
                <span className="text-muted block text-xs">
                  {selected.subtitle}
                </span>
              ) : null}
            </span>

            <span className="text-[0.68rem] font-bold text-[#9a6c42]">
              Zmień
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="paper-wash flex h-11 w-full items-center justify-between rounded-xl border border-[#9a7657]/35 px-3.5 text-left text-sm text-[#7a6048] shadow-sm transition hover:border-[#b48760]/45"
          >
            <span>{placeholder}</span>
            <span className="text-[0.68rem] font-bold text-[#9a6c42]">
              Wybierz
            </span>
          </button>
        )}

        {isOpen ? (
          <div className="paper-wash premium-edge absolute top-[calc(100%+0.55rem)] left-0 z-40 w-full rounded-[1.1rem] p-3 shadow-[0_24px_52px_rgba(18,8,6,0.22)]">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="focus:border-gold focus:ring-gold/20 h-10 w-full rounded-xl border border-[#9a7657]/35 bg-white/80 px-3 text-sm text-[#503828] transition outline-none focus:ring-4"
                autoFocus
              />
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId("");
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="rounded-full px-3 py-2 text-[0.68rem] font-bold text-[#6d503a] transition hover:bg-[#f0dfc8]"
                >
                  Wyczyść
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(option.id);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                      option.id === selectedId
                        ? "bg-[#ead7b6]"
                        : "hover:bg-[#f3e4cf]"
                    }`}
                  >
                    {option.coverUrl !== undefined ? (
                      <GameCover
                        title={option.title}
                        coverUrl={option.coverUrl}
                        size="mini"
                        className="w-13"
                      />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#ead7b6] text-[0.65rem] font-bold text-[#6f523d] uppercase">
                        •
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#4d3528]">
                        {option.title}
                      </span>
                      {option.subtitle ? (
                        <span className="text-muted block text-xs">
                          {option.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-1 text-sm text-[#7a6048]">{emptyLabel}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>
      ) : null}
    </label>
  );
}
