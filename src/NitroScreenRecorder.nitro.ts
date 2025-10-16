import type { HybridObject } from 'react-native-nitro-modules';
import type {
  CameraDevice,
  RecorderCameraStyle,
  PermissionResponse,
  ScreenRecordingFile,
  ScreenRecordingEvent,
  PermissionStatus,
  RecordingError,
  BroadcastPickerPresentationEvent,
  ScreenFrame,
} from './types';

/**
 * ============================================================================
 * NOTES WITH NITRO-MODULES
 * ============================================================================
 * After any change to this file, you have to run
 * `yarn prepare` in the root project folder. This
 * uses `npx expo prebuild --clean` under the hood
 *
 */

export interface NitroScreenRecorder
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  getCameraPermissionStatus(): PermissionStatus;
  getMicrophonePermissionStatus(): PermissionStatus;
  requestCameraPermission(): Promise<PermissionResponse>;
  requestMicrophonePermission(): Promise<PermissionResponse>;

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  addScreenRecordingListener(
    ignoreRecordingsInitiatedElsewhere: boolean,
    callback: (event: ScreenRecordingEvent) => void
  ): number;
  removeScreenRecordingListener(id: number): void;

  addBroadcastPickerListener(
    callback: (event: BroadcastPickerPresentationEvent) => void
  ): number;
  removeBroadcastPickerListener(id: number): void;

  addFrameListener(callback: (frame: ScreenFrame) => void): number;
  removeFrameListener(id: number): void;

  // ============================================================================
  // IN-APP RECORDING
  // ============================================================================

  startInAppRecording(
    enableMic: boolean,
    enableCamera: boolean,
    cameraPreviewStyle: RecorderCameraStyle,
    cameraDevice: CameraDevice,
    onRecordingFinished: (file: ScreenRecordingFile) => void
    // onRecordingError: (error: RecordingError) => void
  ): void;
  stopInAppRecording(): Promise<ScreenRecordingFile | undefined>;
  cancelInAppRecording(): Promise<void>;

  // ============================================================================
  // GLOBAL RECORDING
  // ============================================================================

  startGlobalRecording(
    enableMic: boolean,
    enableRecording: boolean,
    enableStreaming: boolean,
    bitrate: number,
    fps: number,
    onRecordingError: (error: RecordingError) => void
  ): void;
  stopGlobalRecording(
    settledTimeMs: number
  ): Promise<ScreenRecordingFile | undefined>;
  retrieveLastGlobalRecording(): ScreenRecordingFile | undefined;

  // ============================================================================
  // FRAME STREAMING
  // ============================================================================

  enableFrameStreaming(enabled: boolean): void;

  // ============================================================================
  // UTILITIES
  // ============================================================================

  clearRecordingCache(): void;
}
