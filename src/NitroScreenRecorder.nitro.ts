import type { HybridObject } from 'react-native-nitro-modules';
import type { PermissionResponse, ScreenRecordingFile } from './types';
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
export interface NitroScreenRecorder
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  getCameraPermissionStatus(): Promise<PermissionResponse>;
  getMicrophonePermissionStatus(): Promise<PermissionResponse>;
  requestCameraPermission(): Promise<PermissionResponse>;
  requestMicrophonePermission(): Promise<PermissionResponse>;
  startRecording(
    enableMic: boolean,
    enableCamera: boolean,
    systemWideRecording: boolean,
    onRecordingFinished: (file: ScreenRecordingFile) => void
  ): void;
  stopRecording(): void;
  clearFiles(): void;
}
