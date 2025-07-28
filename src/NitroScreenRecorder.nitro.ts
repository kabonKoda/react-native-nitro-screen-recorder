import type { HybridObject } from 'react-native-nitro-modules';
import type {
  CameraDevice,
  RecorderCameraStyle,
  PermissionResponse,
  ScreenRecordingFile,
  ScreenRecordingEvent,
  PermissionStatus,
} from './types';
/**
 * After any change to this file, you have to run
 * `yarn prepare` in the root project folder. This
 * uses `npx expo prebuild --clean` under the hood
 *
 * NOTE: WITH NITROMODULES, DO NOT USE AN OBJECT
 * AS AN INPUT TO ANY FUNCTION, YOU WILL GET SWIFT
 * COMPILE ERRORS THAT GIVE YOU CANCER. JUST BREAK
 * THE OBJECTS INTO INDIVIDUAL PROPERTIES
 */
// type User = {
//   name: string;
//   address: string;
// };

export interface NitroScreenRecorder
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * PERMISSIONS SECTION
   */
  getCameraPermissionStatus(): PermissionStatus;
  getMicrophonePermissionStatus(): PermissionStatus;
  requestCameraPermission(): Promise<PermissionResponse>;
  requestMicrophonePermission(): Promise<PermissionResponse>;
  /**Screen Recording */
  addScreenRecordingListener(
    callback: (event: ScreenRecordingEvent) => void
  ): number;
  removeScreenRecordingListener(id: number): void;
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
  startGlobalRecording(): void;
  getLastGlobalRecording(): ScreenRecordingFile | undefined;

  clearRecordingCache(): void;
}
