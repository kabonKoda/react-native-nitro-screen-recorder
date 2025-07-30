import type { HybridObject } from 'react-native-nitro-modules';
import type {
  CameraDevice,
  RecorderCameraStyle,
  PermissionResponse,
  ScreenRecordingFile,
  ScreenRecordingEvent,
  PermissionStatus,
  RecordingError,
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
    callback: (event: ScreenRecordingEvent) => void
  ): number;
  removeScreenRecordingListener(id: number): void;

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
  stopInAppRecording(): void;
  cancelInAppRecording(): void;

  // ============================================================================
  // GLOBAL RECORDING
  // ============================================================================

  startGlobalRecording(
    enableMic: boolean,
    onRecordingError: (error: RecordingError) => void
  ): void;
  stopGlobalRecording(): void;
  getLastGlobalRecording(): ScreenRecordingFile | undefined;

  // ============================================================================
  // UTILITIES
  // ============================================================================

  clearRecordingCache(): void;
}
