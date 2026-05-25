/**
 * BroadcastChannel used to sync the currently-displayed photo between the
 * main Tedography window and a detached presentation window (/present).
 */

export const PRESENTATION_CHANNEL_NAME = 'tedography.presentation';

export type PresentationMessage =
  | { type: 'photo'; assetId: string; version?: string | null }
  | { type: 'clear' }
  /** Sent by the presentation window on mount to request the current state. */
  | { type: 'hello' }
  /** Sent by the main window in response to 'hello'. */
  | { type: 'current'; assetId: string | null; version?: string | null };
