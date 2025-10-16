import { NitroModules } from 'react-native-nitro-modules';
import type { NitroScreenRecorder } from './NitroScreenRecorder.nitro';
import type {
  ScreenRecordingFile,
  PermissionResponse,
  InAppRecordingInput,
  ScreenRecordingEvent,
  PermissionStatus,
  GlobalRecordingInput,
  BroadcastPickerPresentationEvent,
} from './types';
import { Platform } from 'react-native';

const NitroScreenRecorderHybridObject =
  NitroModules.createHybridObject<NitroScreenRecorder>('NitroScreenRecorder');

const isAndroid = Platform.OS === 'android';

/**
 * Direct access to the NitroScreenRecorder hybrid object for advanced use cases.
 * Use this to call methods like addFrameListener, removeFrameListener, and enableFrameStreaming.
 */
export const ScreenRecorder = NitroScreenRecorderHybridObject;

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Gets the current camera permission status without requesting permission.
 *
 * @platform iOS, Android
 * @returns The current permission status for camera access
 * @example
 * ```typescript
 * const status = getCameraPermissionStatus();
 * if (status === 'granted') {
 *   // Camera is available
 * }
 * ```
 */
export function getCameraPermissionStatus(): PermissionStatus {
  return NitroScreenRecorderHybridObject.getCameraPermissionStatus();
}

/**
 * Gets the current microphone permission status without requesting permission.
 *
 * @platform iOS, Android
 * @returns The current permission status for microphone access
 * @example
 * ```typescript
 * const status = getMicrophonePermissionStatus();
 * if (status === 'granted') {
 *   // Microphone is available
 * }
 * ```
 */
export function getMicrophonePermissionStatus(): PermissionStatus {
  return NitroScreenRecorderHybridObject.getMicrophonePermissionStatus();
}

/**
 * Requests camera permission from the user if not already granted.
 * Shows the system permission dialog if permission hasn't been determined.
 *
 * @platform iOS, Android
 * @returns Promise that resolves with the permission response
 * @example
 * ```typescript
 * const response = await requestCameraPermission();
 * if (response.status === 'granted') {
 *   // Permission granted, can use camera
 * }
 * ```
 */
export async function requestCameraPermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestCameraPermission();
}

/**
 * Requests microphone permission from the user if not already granted.
 * Shows the system permission dialog if permission hasn't been determined.
 *
 * @platform iOS, Android
 * @returns Promise that resolves with the permission response
 * @example
 * ```typescript
 * const response = await requestMicrophonePermission();
 * if (response.status === 'granted') {
 *   // Permission granted, can record audio
 * }
 * ```
 */
export async function requestMicrophonePermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestMicrophonePermission();
}

// ============================================================================
// IN-APP RECORDING
// ============================================================================

/**
 * Starts in-app screen recording with the specified configuration.
 * Records only the current app's content, not system-wide screen content.
 *
 * @platform iOS
 * @param input Configuration object containing recording options and callbacks
 * @returns Promise that resolves when recording starts successfully
 * @example
 * ```typescript
 * await startInAppRecording({
 *   options: {
 *     enableMic: true,
 *     enableCamera: true,
 *     cameraDevice: 'front',
 *     cameraPreviewStyle: { width: 100, height: 150, top: 30, left: 10 }
 *   },
 *   onRecordingFinished: (file) => {
 *     console.log('Recording saved:', file.path);
 *   }
 * });
 * ```
 */
export async function startInAppRecording(
  input: InAppRecordingInput
): Promise<void> {
  if (isAndroid) {
    console.warn('`startInAppRecording` is only supported on iOS.');
    return;
  }

  if (
    input.options.enableMic &&
    getMicrophonePermissionStatus() !== 'granted'
  ) {
    throw new Error('Microphone permission not granted.');
  }

  if (input.options.enableCamera && getCameraPermissionStatus() !== 'granted') {
    throw new Error('Camera permission not granted.');
  }
  // Handle camera options based on enableCamera flag
  if (input.options.enableCamera) {
    return NitroScreenRecorderHybridObject.startInAppRecording(
      input.options.enableMic,
      input.options.enableCamera,
      input.options.cameraPreviewStyle ?? {},
      input.options.cameraDevice,
      input.onRecordingFinished
      // input.onRecordingError
    );
  } else {
    return NitroScreenRecorderHybridObject.startInAppRecording(
      input.options.enableMic,
      input.options.enableCamera,
      {},
      'front',
      input.onRecordingFinished
      // input.onRecordingError
    );
  }
}

/**
 * Stops the current in-app recording and saves the recorded video.
 * The recording file will be provided through the onRecordingFinished callback.
 *
 * @platform iOS-only
 * @example
 * ```typescript
 * stopInAppRecording(); // File will be available in onRecordingFinished callback
 * ```
 */
export async function stopInAppRecording(): Promise<
  ScreenRecordingFile | undefined
> {
  if (isAndroid) {
    console.warn('`stopInAppRecording` is only supported on iOS.');
    return;
  }
  return NitroScreenRecorderHybridObject.stopInAppRecording();
}

/**
 * Cancels the current in-app recording without saving the video.
 * No file will be generated and onRecordingFinished will not be called.
 *
 * @platform iOS-only
 * @example
 * ```typescript
 * cancelInAppRecording(); // Recording discarded, no file saved
 * ```
 */
export async function cancelInAppRecording(): Promise<void> {
  if (isAndroid) {
    console.warn('`cancelInAppRecording` is only supported on iOS.');
    return;
  }
  return NitroScreenRecorderHybridObject.cancelInAppRecording();
}

// ============================================================================
// GLOBAL RECORDING
// ============================================================================

/**
 * Starts global screen recording that captures the entire device screen.
 * Records system-wide content, including other apps and system UI.
 * Requires screen recording permission on iOS.
 *
 * @platform iOS, Android
 * @example
 * ```typescript
 * startGlobalRecording({
 *   options: {
 *     enableMic: true,
 *     enableRecording: true,
 *     enableStreaming: false,
 *     bitrate: 5000000, // 5 Mbps
 *     fps: 30
 *   },
 *   onRecordingError: (error) => console.error(error)
 * });
 * // User can now navigate to other apps while recording continues
 * ```
 */
export function startGlobalRecording(input: GlobalRecordingInput): void {
  // On IOS, the user grants microphone permission via a picker toggle
  // button, so we don't need this check first
  if (
    input.options?.enableMic &&
    isAndroid &&
    getMicrophonePermissionStatus() !== 'granted'
  ) {
    throw new Error('Microphone permission not granted.');
  }

  const enableRecording = input.options?.enableRecording ?? true;
  const enableStreaming = input.options?.enableStreaming ?? false;

  // Validate that at least one mode is enabled
  if (!enableRecording && !enableStreaming) {
    throw new Error(
      'At least one of enableRecording or enableStreaming must be true'
    );
  }

  return NitroScreenRecorderHybridObject.startGlobalRecording(
    input?.options?.enableMic ?? false,
    enableRecording,
    enableStreaming,
    input?.options?.bitrate ?? 0, // 0 means use platform default
    input?.options?.fps ?? 30,
    input?.onRecordingError
  );
}

/**
 * Stops the current global screen recording and saves the video.
 * The recorded file can be retrieved using retrieveLastGlobalRecording().
 *
 * @platform Android/ios
 * @param options.settledTimeMs A "delay" time to wait before the function
 * tries to retrieve the file from the asset writer. It can take some time
 * to finish completion and correclty return the file. Default = 500ms
 * @example
 * ```typescript
 * const file = await stopGlobalRecording({ settledTimeMs: 1000 });
 * if (file) {
 *   console.log('Global recording saved:', file.path);
 * }
 * ```
 */
export async function stopGlobalRecording(options?: {
  settledTimeMs: number;
}): Promise<ScreenRecordingFile | undefined> {
  let settledTimeMs = 500;
  if (options?.settledTimeMs) {
    if (
      typeof options.settledTimeMs !== 'number' ||
      options.settledTimeMs <= 0
    ) {
      console.warn(
        'Provided invalid value to `settledTimeMs` in `stopGlobalRecording` function, value will be ignored. Please use a value >0'
      );
    } else {
      settledTimeMs = options.settledTimeMs;
    }
  }
  return NitroScreenRecorderHybridObject.stopGlobalRecording(settledTimeMs);
}

/**
 * Retrieves the most recently completed global recording file.
 * Returns undefined if no global recording has been completed.
 *
 * @platform iOS, Android
 * @returns The last global recording file or undefined if none exists
 * @example
 * ```typescript
 * const lastRecording = retrieveLastGlobalRecording();
 * if (lastRecording) {
 *   console.log('Duration:', lastRecording.duration);
 *   console.log('File size:', lastRecording.size);
 * }
 * ```
 */
export function retrieveLastGlobalRecording(): ScreenRecordingFile | undefined {
  return NitroScreenRecorderHybridObject.retrieveLastGlobalRecording();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Adds a listener for screen recording events (began, ended, etc.).
 * Returns a cleanup function to remove the listener when no longer needed.
 *
 * @platform iOS, Android
 * @param listener Callback function that receives screen recording events
 * @returns Cleanup function to remove the listener
 * @example
 * ```typescript
 * useEffect(() => {
 *  const removeListener = addScreenRecordingListener((event: ScreenRecordingEvent) => {
 *    console.log("Event type:", event.type, "Event reason:", event.reason)
 *  });
 * // Later, remove the listener
 * return () => removeListener();
 * },[])
 * ```
 */
export function addScreenRecordingListener({
  listener,
  ignoreRecordingsInitiatedElsewhere = false,
}: {
  listener: (event: ScreenRecordingEvent) => void;
  ignoreRecordingsInitiatedElsewhere: boolean;
}): () => void {
  let listenerId: number;
  listenerId = NitroScreenRecorderHybridObject.addScreenRecordingListener(
    ignoreRecordingsInitiatedElsewhere,
    listener
  );
  return () => {
    NitroScreenRecorderHybridObject.removeScreenRecordingListener(listenerId);
  };
}

/**
 * Adds a listener for ios only to track whether (start, stop, error, etc.).
 * Returns a cleanup function to remove the listener when no longer needed.
 *
 * @platform iOS
 * @param listener Callback function that receives the status of the BroadcastPickerView
 * on ios
 * @returns Cleanup function to remove the listener
 * @example
 * ```typescript
 * useEffect(() => {
 *  const removeListener = addBroadcastPickerListener((event: BroadcastPickerPresentationEvent) => {
 *    console.log("Picker status", event)
 *  });
 * // Later, remove the listener
 * return () => removeListener();
 * },[])
 * ```
 */
export function addBroadcastPickerListener(
  listener: (event: BroadcastPickerPresentationEvent) => void
): () => void {
  if (Platform.OS === 'android') {
    // return a no-op cleanup function
    return () => {};
  }
  let listenerId: number;
  listenerId =
    NitroScreenRecorderHybridObject.addBroadcastPickerListener(listener);
  return () => {
    NitroScreenRecorderHybridObject.removeBroadcastPickerListener(listenerId);
  };
}

/**
 * Adds a listener for frame capture events during screen recording.
 * Returns a cleanup function to remove the listener when no longer needed.
 *
 * @platform iOS, Android
 * @param listener Callback function that receives captured frames
 * @returns Cleanup function to remove the listener
 * @example
 * ```typescript
 * useEffect(() => {
 *  const removeListener = addFrameListener((frame) => {
 *    console.log("Frame captured:", frame.width, "x", frame.height)
 *  });
 * // Later, remove the listener
 * return () => removeListener();
 * },[]);
 * ```
 */
export function addFrameListener(listener: (frame: any) => void): () => void {
  let listenerId: number;
  listenerId = NitroScreenRecorderHybridObject.addFrameListener(listener);
  return () => {
    NitroScreenRecorderHybridObject.removeFrameListener(listenerId);
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Clears all cached recording files to free up storage space.
 * This will delete temporary files but not files that have been explicitly saved.
 *
 * @platform iOS, Android
 * @example
 * ```typescript
 * clearCache(); // Frees up storage by removing temporary recording files
 * ```
 */
export function clearCache(): void {
  return NitroScreenRecorderHybridObject.clearRecordingCache();
}
