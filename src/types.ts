export type PermissionStatus = 'denied' | 'granted' | 'undetermined';

export type PermissionExpiration = never | number;

export type PermissionResponse = {
  canAskAgain: boolean;
  granted: boolean;
  status: PermissionStatus;
  expiresAt: PermissionExpiration;
};

// TODO: Support Camera and camera position

export type RecorderCameraStyle = {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  borderWidth?: number;
};

export type CameraDevice = 'front' | 'back';

export type RecordingOptions =
  | {
      enableMic: boolean;
      enableCamera: true;
      cameraPreviewStyle: RecorderCameraStyle;
      cameraDevice: CameraDevice;
    }
  | { enableCamera: false; enableMic: boolean };

export type InAppRecordingInput = {
  options: RecordingOptions;
  onRecordingFinished: (file: ScreenRecordingFile) => void;
  // onRecordingError: (error: RecordingError) => void;
};

export type GlobalRecordingInput = {
  onRecordingError: (error: RecordingError) => void;
};

export interface ScreenRecordingFile {
  recordingId: string;
  path: string;
  name: string;
  size: number;
  duration: number;
  timestampCreated: Date;
  timestampFinished: Date;
  enabledMicrophone: boolean;
  status: string;
}

export interface RecordingError {
  name: string;
  message: string;
}

export type RecordingEventReason = 'began' | 'ended';

export type RecordingEventType = 'global' | 'withinApp'; // Deprecated but still kind of valid

export interface ScreenRecordingEvent {
  type: RecordingEventType;
  reason: RecordingEventReason;
}
