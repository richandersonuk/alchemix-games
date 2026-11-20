/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the scoreboard server (no trailing slash). Empty = same origin (/api). */
  readonly VITE_SCOREBOARD_URL?: string;
  /** Where "Quit" goes when the game is opened directly (not embedded in the hub). */
  readonly VITE_ARCADE_HUB_URL?: string;
  /** Comma-separated origins allowed for ?hub= return URLs and postMessage. */
  readonly VITE_ARCADE_HUB_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
