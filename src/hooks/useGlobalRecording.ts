import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ScreenRecordingFile } from '../types';
import {
  getLastGlobalRecording,
  addScreenRecordingListener,
} from '../functions';

/**
 * Options for {@link useGlobalRecording}.
 *
 * **When to enable `refetchOnAppForeground`:**
 * - Turn this on if users might stop a global recording while your app is backgrounded.
 * - With it enabled, the hook will refresh as soon as your app becomes active again,
 *   which avoids extra disk work while backgrounded and yields fresher results on return.
 */
export interface GlobalRecordingHookInput {
  /** Refresh on `AppState` transition to `"active"`. */
  refetchOnAppForeground: boolean;
}

/**
 * Result returned by {@link useGlobalRecording}.
 *
 * **Recommended UI pattern:**
 * - Show a lightweight “Processing…” or spinner while `isLoading` is `true` after a recording ends.
 * - When `recording` becomes defined, proceed to upload, share, or preview.
 * - If `isError` is `true`, show a retry affordance wired to `refetch()`.
 */
export interface GlobalRecordingHookOutput {
  /** The most recent completed global recording, or `undefined` if none is available. */
  recording: ScreenRecordingFile | undefined;
  /** `true` while the hook is actively resolving the latest recording. */
  isLoading: boolean;
  /** `true` if the most recent attempt to resolve the latest recording failed. */
  isError: boolean;
  /** The error from the most recent failure, if any. */
  error: Error | null;
  /**
   * Immediately re-check for the latest global recording (skips the settle delay).
   * Useful for user‑initiated refresh (pull‑to‑refresh, “Try again” button).
   */
  refetch: () => void;
}

/**
 * Compare two `ScreenRecordingFile` descriptors to avoid redundant state updates.
 * Assumes filename + duration uniquely identify the finalized output in your pipeline.
 */
function isSameRecording(
  current: ScreenRecordingFile | undefined,
  latest: ScreenRecordingFile | null
): boolean {
  if (!current || !latest) return false;
  return current.name === latest.name && current.duration === latest.duration;
}

/**
 * Promise-based delay helper.
 */
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Subscribe to global recording lifecycle and expose the most recent finished file.
 *
 * ### What this hook does
 * - Listens to your package's global recording events (`began` → `ended`).
 * - On `ended`, waits ~1.5s so the extension/asset writer can finish closing the file,
 *   then resolves the latest recording via `getLastGlobalRecording()`.
 * - Optionally fetches the file when the app returns to the foreground.
 *
 *
 *
 * @param input Hook options. See {@link GlobalRecordingHookInput}.
 * @returns See {@link GlobalRecordingHookOutput}.
 *
 * @example
 * ```ts
 * const { recording, isLoading, isError, error, refetch } =
 *   useGlobalRecording({ refetchOnAppForeground: true });
 *
 * useEffect(() => {
 *   if (recording) {
 *     // e.g., uploadRecording(recording.path)
 *   }
 * }, [recording]);
 * ```
 */
export const useGlobalRecording = (
  input?: GlobalRecordingHookInput
): GlobalRecordingHookOutput => {
  const [recording, setRecording] = useState<ScreenRecordingFile | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const recordingInProgressRef = useRef(false);

  const clearError = useCallback(() => {
    setIsError(false);
    setError(null);
  }, []);

  const fetchLatestRecording = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      await delay(1500);
      const latest = getLastGlobalRecording();

      if (latest) {
        if (isSameRecording(recording, latest)) return;
        setRecording(latest);
      } else {
        setRecording(undefined);
      }
    } catch (err) {
      const errorObj =
        err instanceof Error
          ? err
          : new Error('Failed to fetch global recording');
      setError(errorObj);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [clearError, recording]);

  const refetch = useCallback(() => {
    try {
      clearError();
      const latest = getLastGlobalRecording();

      if (latest) {
        if (isSameRecording(recording, latest)) return;
        setRecording(latest);
      } else {
        setRecording(undefined);
      }
    } catch (err) {
      const errorObj =
        err instanceof Error
          ? err
          : new Error('Failed to fetch global recording');
      setError(errorObj);
      setIsError(true);
    }
  }, [clearError, recording]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active' &&
          input?.refetchOnAppForeground
        ) {
          refetch();
        }
        appState.current = nextAppState;
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [refetch, input?.refetchOnAppForeground, isLoading]);

  useEffect(() => {
    const unsubscribe = addScreenRecordingListener((event) => {
      if (event.type === 'global' && event.reason === 'began') {
        recordingInProgressRef.current = true;
      }

      const shouldLetAppFocusHandlerRefetch =
        appState.current.match(/inactive|background/) &&
        input?.refetchOnAppForeground;

      if (
        event.type === 'global' &&
        event.reason === 'ended' &&
        recordingInProgressRef.current &&
        !shouldLetAppFocusHandlerRefetch
      ) {
        recordingInProgressRef.current = false;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          fetchLatestRecording();
        }, 100);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchLatestRecording, input?.refetchOnAppForeground]);

  return {
    recording,
    isLoading,
    isError,
    error,
    refetch,
  };
};
