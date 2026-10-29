import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { useT } from "../i18n";

type CopyState = "idle" | "copied" | "failed";

/** How long "Gekopieerd" stays up: long enough to read on a phone. */
export const COPIED_MS = 2000;

/**
 * Puts `term` on the clipboard and reports how it went for COPIED_MS.
 * `copy` must run straight from the click: iOS Safari refuses a clipboard
 * write that waits on anything first. The clipboard is missing outside
 * HTTPS and may be refused; that is "failed", never an error.
 */
export function useCopy(term: string) {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = window.setTimeout(() => setState("idle"), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [state]);
  const copy = () => {
    const write = navigator.clipboard?.writeText(term);
    if (!write) return setState("failed");
    write.then(
      () => setState("copied"),
      () => setState("failed"),
    );
  };
  return { state, copy };
}

/** Says "Gekopieerd" to screen readers. Always in the DOM, so screen readers
 *  that only watch a live region present from the start still hear it. */
export function CopyStatus({ state, term }: { state: CopyState; term: string }) {
  const txt = useT();
  return (
    <span role="status" className="sr-only">
      {state === "copied" ? txt.termCopied(term) : state === "failed" ? txt.termCopyFailed : ""}
    </span>
  );
}

/**
 * A pill that copies one search term, for GVB's lift-fault search box (which
 * a link cannot fill in). One term per pill: GVB finds nothing for two
 * station names typed together. 32px tall, with the tap area stretched to
 * 44px; give the row of pills `gap-y-3` so stretched areas do not overlap.
 */
export function CopyTerm({ term, className = "" }: { term: string; className?: string }) {
  const txt = useT();
  const { state, copy } = useCopy(term);
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={txt.copyTerm(term)}
        className={`relative inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${className}`}
      >
        {state === "copied" ? (
          <Check size={11} className="shrink-0" aria-hidden />
        ) : state === "failed" ? (
          <X size={11} className="shrink-0" aria-hidden />
        ) : (
          <Copy size={11} className="shrink-0" aria-hidden />
        )}
        {/* A failed copy keeps the term in view, to type in by hand. */}
        <span aria-hidden>{state === "copied" ? txt.copied : term}</span>
      </button>
      <CopyStatus state={state} term={term} />
    </>
  );
}
