import type { HybridObject } from 'react-native-nitro-modules';
import type { RecordingOptions, ScreenRecordingFile } from './types';

export interface NitroScreenRecorder
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  multiply(a: number, b: number): number;
  getCameraPermissionStatus(): Promise<void>;
  getMicrophonePermissionStatus(): Promise<void>;
  requestCameraPermission(): Promise<void>;
  requestMicrophonePermission(): Promise<void>;
  startRecording(
    options: RecordingOptions,
    onRecordingFinishedCallback: (file: ScreenRecordingFile) => void,
    onRecordingErrorCallback: (error: Error) => void
  ): Promise<void>;
  stopRecording(): void;
  clearFiles(): void;
}
