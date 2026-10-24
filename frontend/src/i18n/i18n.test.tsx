import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LanguageToggle } from "../components/LanguageToggle";
import { StationIndex } from "../travel/StationIndex";
import { countdown, duration } from "../travel/time";
import { getLang, pick, setLang } from "./index";

const index = (
  <StationIndex
    stations={[]}
    lineIds={["52"]}
    colorOf={() => "#999"}
    current={null}
    favourites={[]}
    recent={[]}
    locating={false}
    onStation={() => {}}
    onNearby={() => {}}
    onClearRecent={() => {}}
  />
);

describe("language", () => {
  it("toggles, remembers the choice and marks the document", async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(getLang()).toBe("en");
    expect(localStorage.getItem("metro-lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "Wissel naar Nederlands" })).toHaveTextContent("NL");
  });

  it("re-renders the travel page's strings", async () => {
    render(<><LanguageToggle />{index}</>);
    expect(screen.getByText("Dichtstbijzijnde station")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(screen.getByText("Nearest station")).toBeInTheDocument();
    expect(screen.getByText("All stations A–Z")).toBeInTheDocument();
  });

  it("switches formatters too", () => {
    const now = 1_800_000_000_000;
    expect(duration(65 * 60)).toBe("1 u 5 min");
    expect(countdown(now / 1000 - 120, now)).toBe("vertrokken");
    setLang("en", { persist: false });
    expect(duration(65 * 60)).toBe("1 h 5 min");
    expect(countdown(now / 1000 - 120, now)).toBe("departed");
  });

  it("picks the feed's English, falling back to Dutch", () => {
    expect(pick({ nl: "Hallo", en: "Hello" }, "en")).toBe("Hello");
    expect(pick({ nl: "Hallo", en: null }, "en")).toBe("Hallo");
    expect(pick({ nl: "Hallo", en: "Hello" }, "nl")).toBe("Hallo");
  });
});
