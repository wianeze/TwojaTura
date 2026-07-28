"use client";

import { useActionState, useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { submitFeedbackAction } from "./actions";
import { FEEDBACK_MAX_LENGTH } from "./constants";
import { INITIAL_FEEDBACK_FORM_STATE } from "./form-state";

const COLLAPSE_DELAY_MS = 1800;

export function FeedbackSubmitPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [state, formAction, isPending] = useActionState(
    submitFeedbackAction,
    INITIAL_FEEDBACK_FORM_STATE,
  );

  // Both state updates are deferred via setTimeout rather than called
  // synchronously in the effect body (React's set-state-in-effect lint rule
  // disallows the latter). Clearing uses a 0ms timer — imperceptible to the
  // user, effectively "right away" — while collapsing genuinely waits, so
  // the success message stays visible for a moment first.
  useEffect(() => {
    if (state.status !== "success") return;
    const clearTimer = setTimeout(() => setContent(""), 0);
    const collapseTimer = setTimeout(
      () => setIsExpanded(false),
      COLLAPSE_DELAY_MS,
    );
    return () => {
      clearTimeout(clearTimer);
      clearTimeout(collapseTimer);
    };
  }, [state]);

  return (
    <Panel
      style={{ animationDelay: `${getEntranceStaggerDelayMs(5)}ms` }}
      className="anim-rise-in-fast paper-wash p-3.5 sm:p-4"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls="feedback-submit-form"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-[#4c3528]"
      >
        Zgłoś poprawkę
        <span aria-hidden="true" className="text-accent text-base leading-none">
          {isExpanded ? "−" : "+"}
        </span>
      </button>

      {isExpanded ? (
        <form
          id="feedback-submit-form"
          action={formAction}
          className="mt-3 space-y-2"
        >
          <textarea
            name="content"
            value={content}
            onChange={(event) =>
              setContent(event.target.value.slice(0, FEEDBACK_MAX_LENGTH))
            }
            maxLength={FEEDBACK_MAX_LENGTH}
            placeholder="Co warto poprawić lub dodać?"
            required
            rows={3}
            disabled={isPending}
            className="focus:border-gold focus:ring-gold/20 w-full rounded-xl border border-[#9a7657]/35 bg-white/70 px-3 py-2 text-sm text-[#503828] transition outline-none focus:ring-4 disabled:opacity-65"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#6f5640]">
              {content.length}/{FEEDBACK_MAX_LENGTH}
            </span>
            <button
              type="submit"
              disabled={isPending || content.trim().length === 0}
              className="cta-glow rounded-full border border-[#efbf82]/30 bg-[#9b5538]/92 px-4 py-1.5 text-xs font-bold text-[#fff0db] disabled:opacity-60"
            >
              {isPending ? "Wysyłanie…" : "Wyślij zgłoszenie"}
            </button>
          </div>

          {state.message ? (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                state.status === "error"
                  ? "bg-[#8f3528]/10 text-[#8f3528]"
                  : "bg-moss/12 text-moss"
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </Panel>
  );
}
