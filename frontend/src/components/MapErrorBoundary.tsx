import { Component, ReactNode } from "react";
import { strings } from "../i18n";

/**
 * Keeps a map crash inside the map. Without it an error thrown while the map
 * renders (seen when a lost WebGL context was being restored) unmounted the
 * whole app: menu, badge and departure card gone, a blank page until reload.
 * The fallback offers a fresh map; App remounts it with a new key.
 */
export class MapErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Map crashed; showing the reload button", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const txt = strings();
    return (
      <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <p className="font-semibold">{txt.mapCrashed}</p>
        <button
          type="button"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset();
          }}
          className="min-h-11 rounded-lg bg-[#4363D8] px-4 py-2 font-semibold text-white hover:bg-[#3651b8]"
        >
          {txt.mapReload}
        </button>
      </div>
    );
  }
}
