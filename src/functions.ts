import { NitroModules } from 'react-native-nitro-modules';
import type { NitroScreenRecorder } from './NitroScreenRecorder.nitro';
import {
  ScreenRecordingFile,
  PermissionResponse,
  InAppRecordingInput,
  ScreenRecordingEvent,
  PermissionStatus,
  GlobalRecordingInput,
} from './types';
import { Platform } from 'react-native';

const NitroScreenRecorderHybridObject =
  NitroModules.createHybridObject<NitroScreenRecorder>('NitroScreenRecorder');

const isAndroid = Platform.OS === 'android';

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
 * startGlobalRecording();
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
  return NitroScreenRecorderHybridObject.startGlobalRecording(
    input?.options?.enableMic ?? false,
    input?.onRecordingError
  );
}

/**
 * Stops the current global screen recording and saves the video.
 * The recorded file can be retrieved using getLastGlobalRecording().
 * Note on iOS, a broadcast is ended by tapping on the red broadcasting dot
 * in the corner of the screen. On Android, its handled via button.
 *
 * @platform Android-only
 * @example
 * ```typescript
 * stopGlobalRecording();
 * const file = getLastGlobalRecording();
 * if (file) {
 *   console.log('Global recording saved:', file.path);
 * }
 * ```
 */
export function stopGlobalRecording(): Promise<
  ScreenRecordingFile | undefined
> {
  return NitroScreenRecorderHybridObject.stopGlobalRecording();
}

/**
 * Retrieves the most recently completed global recording file.
 * Returns undefined if no global recording has been completed.
 *
 * @platform iOS, Android
 * @returns The last global recording file or undefined if none exists
 * @example
 * ```typescript
 * const lastRecording = getLastGlobalRecording();
 * if (lastRecording) {
 *   console.log('Duration:', lastRecording.duration);
 *   console.log('File size:', lastRecording.size);
 * }
 * ```
 */
export function getLastGlobalRecording(): ScreenRecordingFile | undefined {
  return NitroScreenRecorderHybridObject.getLastGlobalRecording();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Adds a listener for screen recording events (start, stop, error, etc.).
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
export function addScreenRecordingListener(
  listener: (event: ScreenRecordingEvent) => void
): () => void {
  let listenerId: number;
  listenerId =
    NitroScreenRecorderHybridObject.addScreenRecordingListener(listener);
  return () => {
    NitroScreenRecorderHybridObject.removeScreenRecordingListener(listenerId);
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
