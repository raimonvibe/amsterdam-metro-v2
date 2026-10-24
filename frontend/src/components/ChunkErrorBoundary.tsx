import { Component, ReactNode } from "react";
import { strings } from "../i18n";

/**
 * Catches a lazily loaded page whose chunk fails to load. After a deploy the
 * old hashed chunks are gone, so a visitor who opened the map before it gets
 * a 404 on the first click; without this the whole app unmounts to a blank
 * screen. A reload fetches the new index.html and its chunks.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#f3eee3] p-6 text-center text-sm text-[#1d2433] dark:bg-[#0a0e18] dark:text-[#e3ddcf]"
      >
        <p className="font-academic text-lg">{strings().chunkFailed}</p>
        <p className="max-w-sm text-[#5b5446] dark:text-[#a9b0c2]">
          {strings().chunkFailedHint}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-[#4363D8] px-3 py-2 font-semibold text-white hover:bg-[#3651b8]"
          >
            {strings().reload}
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ failed: false });
              this.props.onClose();
            }}
            className="rounded-md border border-[#d8cfbd] px-3 py-2 font-semibold dark:border-[#2a3245]"
          >
            {strings().backToMap}
          </button>
        </div>
      </div>
    );
  }
}
