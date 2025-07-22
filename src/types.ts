export type PermissionStatus = 'denied' | 'granted' | 'undetermined';

export type PermissionExpiration = never | number;

export type PermissionResponse = {
  canAskAgain: boolean;
  granted: boolean;
  status: PermissionStatus;
  expiresAt: PermissionExpiration;
};

export type RecordingOptions = {
  enableMic: boolean;
  enableCamera: boolean;
};

export interface ScreenRecordingFile {
  path: string;
  duration: number;
}

export interface RecordingError {
  name: string;
  message: string;
}
