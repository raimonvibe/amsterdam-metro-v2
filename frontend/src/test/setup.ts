import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { setLang } from "../i18n";

// jsdom's browser says en-US; the tests read the Dutch UI unless they switch.
beforeEach(() => setLang("nl", { persist: false }));

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage unavailable */
  }
});
