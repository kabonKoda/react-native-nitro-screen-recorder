import { NitroModules } from 'react-native-nitro-modules';
import type { NitroScreenRecorder } from './NitroScreenRecorder.nitro';
import {
  ScreenRecordingFile,
  PermissionResponse,
  InAppRecordingInput,
  ScreenRecordingEvent,
  PermissionStatus,
} from './types';

const NitroScreenRecorderHybridObject =
  NitroModules.createHybridObject<NitroScreenRecorder>('NitroScreenRecorder');

export function getCameraPermissionStatus(): PermissionStatus {
  return NitroScreenRecorderHybridObject.getCameraPermissionStatus();
}

export function getMicrophonePermissionStatus(): PermissionStatus {
  return NitroScreenRecorderHybridObject.getMicrophonePermissionStatus();
}

export async function requestCameraPermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestCameraPermission();
}

export async function requestMicrophonePermission(): Promise<PermissionResponse> {
  return NitroScreenRecorderHybridObject.requestMicrophonePermission();
}

export async function startInAppRecording(
  input: InAppRecordingInput
): Promise<void> {
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

export function cancelInAppRecording(): void {
  return NitroScreenRecorderHybridObject.cancelInAppRecording();
}

export function startGlobalRecording(): void {
  return NitroScreenRecorderHybridObject.startGlobalRecording();
}

export function getLastGlobalRecording(): ScreenRecordingFile | undefined {
  return NitroScreenRecorderHybridObject.getLastGlobalRecording();
}

export function stopInAppRecording(): void {
  return NitroScreenRecorderHybridObject.stopInAppRecording();
}

export function clearCache(): void {
  return NitroScreenRecorderHybridObject.clearRecordingCache();
}

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
