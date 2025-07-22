import { NitroModules } from 'react-native-nitro-modules';
import type { NitroScreenRecorder } from './NitroScreenRecorder.nitro';
import {
  ScreenRecordingFile,
  RecordingOptions,
  PermissionResponse,
} from './types';

const NitroScreenRecorderHybridObject =
  NitroModules.createHybridObject<NitroScreenRecorder>('NitroScreenRecorder');

export async function getCameraPermissionStatus(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.getCameraPermissionStatus();
}

export async function getMicrophonePermissionStatus(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.getMicrophonePermissionStatus();
}

export async function requestCameraPermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestCameraPermission();
}

export async function requestMicrophonePermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestMicrophonePermission();
}

export async function startInAppRecording(
  options: RecordingOptions,
  onRecordingFinished: (file: ScreenRecordingFile) => void
  // onRecordingError: (message: string) => void
): Promise<void> {
  return NitroScreenRecorderHybridObject.startInAppRecording(
    options.enableMic,
    options.enableCamera,
    onRecordingFinished
    // onRecordingError
  );
}

export async function startGlobalRecording(
  options: RecordingOptions,
  onRecordingFinished: (file: ScreenRecordingFile) => void
  // onRecordingError: (message: string) => void
): Promise<void> {
  return NitroScreenRecorderHybridObject.startGlobalRecording(
    options.enableMic,
    options.enableCamera,
    onRecordingFinished
    // onRecordingError
  );
}

export function stopRecording(): void {
  return NitroScreenRecorderHybridObject.stopRecording();
}
