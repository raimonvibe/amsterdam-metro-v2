import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n";
import { COPIED_MS, CopyTerm } from "./CopyTerm";

function clipboard(writeText: unknown) {
  Object.defineProperty(navigator, "clipboard", { value: writeText ? { writeText } : undefined, configurable: true });
}

afterEach(() => {
  clipboard(undefined);
  act(() => setLang("nl", { persist: false }));
  vi.useRealTimers();
});

describe("CopyTerm", () => {
  it("copies its one term, says so on the pill and to screen readers, then goes back", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<CopyTerm term="Bullewijk" />);
    const pill = screen.getByRole("button", { name: 'Kopieer "Bullewijk"' });
    await act(async () => fireEvent.click(pill));
    expect(writeText).toHaveBeenCalledWith("Bullewijk");
    expect(pill).toHaveTextContent("Gekopieerd");
    expect(screen.getByRole("status")).toHaveTextContent('"Bullewijk" gekopieerd');
    act(() => vi.advanceTimersByTime(COPIED_MS));
    expect(pill).toHaveTextContent("Bullewijk");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps the term in view when the clipboard is refused or missing", async () => {
    clipboard(vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")));
    render(<CopyTerm term="Diemen Zuid" />);
    const pill = screen.getByRole("button", { name: 'Kopieer "Diemen Zuid"' });
    await act(async () => fireEvent.click(pill));
    expect(pill).toHaveTextContent("Diemen Zuid");
    expect(screen.getByRole("status")).toHaveTextContent("Kopiëren lukte niet");

    clipboard(undefined);
    await act(async () => fireEvent.click(pill));
    expect(pill).toHaveTextContent("Diemen Zuid");
  });

  it("speaks English too", () => {
    act(() => setLang("en", { persist: false }));
    render(<CopyTerm term="Bullewijk" />);
    expect(screen.getByRole("button", { name: 'Copy "Bullewijk"' })).toBeInTheDocument();
  });
});
