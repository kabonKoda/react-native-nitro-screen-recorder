/**
 * Represents the current status of a device permission.
 *
 * @example
 * ```typescript
 * const status: PermissionStatus = 'granted';
 * ```
 */
export type PermissionStatus = 'denied' | 'granted' | 'undetermined';

/**
 * Represents when a permission expires.
 * Most permissions never expire, but some may have a timestamp.
 *
 * @example
 * ```typescript
 * const expiration: PermissionExpiration = never; // Most common case
 * const timedExpiration: PermissionExpiration = Date.now() + 3600000; // Expires in 1 hour
 * ```
 */
export type PermissionExpiration = never | number;

/**
 * Complete response object returned when requesting device permissions.
 * Contains all information about the permission state and user interaction.
 *
 * @example
 * ```typescript
 * const response: PermissionResponse = {
 *   canAskAgain: true,
 *   granted: true,
 *   status: 'granted',
 *   expiresAt: never
 * };
 * ```
 */
export type PermissionResponse = {
  /** Whether the permission dialog can be shown again if denied */
  canAskAgain: boolean;
  /** Simplified boolean indicating if permission was granted */
  granted: boolean;
  /** Detailed permission status */
  status: PermissionStatus;
  /** When this permission expires, if applicable */
  expiresAt: PermissionExpiration;
};

/**
 * Styling configuration for the camera preview overlay during recording.
 * All dimensions are in points/pixels relative to the screen.
 *
 * @example
 * ```typescript
 * const cameraStyle: RecorderCameraStyle = {
 *   top: 50,
 *   left: 20,
 *   width: 120,
 *   height: 160,
 *   borderRadius: 8,
 *   borderWidth: 2
 * };
 * ```
 */
export type RecorderCameraStyle = {
  /** Distance from top of screen */
  top?: number;
  /** Distance from left of screen */
  left?: number;
  /** Width of camera preview */
  width?: number;
  /** Height of camera preview */
  height?: number;
  /** Corner radius for rounded corners */
  borderRadius?: number;
  /** Border thickness around camera preview */
  borderWidth?: number;
};

/**
 * Specifies which camera to use for recording.
 *
 * @example
 * ```typescript
 * const camera: CameraDevice = 'front'; // For selfie camera
 * const backCamera: CameraDevice = 'back'; // For rear camera
 * ```
 */
export type CameraDevice = 'front' | 'back';

/**
 * Recording configuration options. Uses discriminated union to ensure
 * camera-related options are only available when camera is enabled.
 *
 * @example
 * ```typescript
 * // With camera enabled (iOS only)
 * const withCamera: RecordingOptions = {
 *   enableMic: true,
 *   enableCamera: true,
 *   cameraPreviewStyle: { width: 100, height: 100 },
 *   cameraDevice: 'front'
 * };
 *
 * // Without camera
 * const withoutCamera: RecordingOptions = {
 *   enableCamera: false,
 *   enableMic: true
 * };
 * ```
 */
export type InAppRecordingOptions =
  | {
      /** Whether to record microphone audio */
      enableMic: boolean;
      /** iOS Only: Camera is enabled - requires camera options */
      enableCamera: true;
      /** Styling for camera preview overlay */
      cameraPreviewStyle: RecorderCameraStyle;
      /** Which camera to use */
      cameraDevice: CameraDevice;
    }
  | {
      /** Camera is disabled - no camera options needed */
      enableCamera: false;
      /** Whether to record microphone audio */
      enableMic: boolean;
    };

/**
 * Complete input configuration for starting an in-app recording session.
 *
 * @example
 * ```typescript
 * const recordingInput: InAppRecordingInput = {
 *   options: {
 *     enableMic: true,
 *     enableCamera: true,
 *     cameraPreviewStyle: { width: 120, height: 160, top: 50, left: 20 },
 *     cameraDevice: 'front'
 *   },
 *   onRecordingFinished: (file) => {
 *     console.log('Recording completed:', file.path);
 *   }
 * };
 * ```
 */
export type InAppRecordingInput = {
  /** Recording configuration options */
  options: InAppRecordingOptions;
  /** Callback invoked when recording completes successfully */
  onRecordingFinished: (file: ScreenRecordingFile) => void;
};

/**
 * Options for a global screen recording session.
 */
export type GlobalRecordingInputOptions = {
  /** Whether to record microphone audio during the global recording. */
  enableMic: boolean;
  /** Whether to enable video recording to file (default: true). At least one of enableRecording or enableStreaming must be true. */
  enableRecording?: boolean;
  /** Whether to enable frame streaming for real-time processing (default: false). At least one of enableRecording or enableStreaming must be true. */
  enableStreaming?: boolean;
  /** Video bitrate in bits per second (default: platform-specific, typically 5Mbps for 1080p) */
  bitrate?: number;
  /** Target frames per second for recording (default: 30). Note: streaming fps is controlled separately via FrameStreamConfig */
  fps?: number;
};

/**
 * Complete input configuration for starting a global recording session.
 *
 * @example
 * ```typescript
 * const globalInput: GlobalRecordingInput = {
 *   options: {
 *     enableMic: true, // Enable microphone audio for the recording
 *   },
 *   onRecordingError: (error) => {
 *     console.error('Global recording failed:', error.message);
 *     // Handle the error, e.g., display an alert to the user.
 *   }
 * };
 * ```
 */
export type GlobalRecordingInput = {
  /** Optional configuration options for the global recording session. */
  options?: GlobalRecordingInputOptions;
  /** Callback invoked when the global recording encounters an error during start or execution. */
  onRecordingError: (error: RecordingError) => void;
};

/**
 * Represents a completed screen recording file with metadata.
 * Contains all information needed to access and display the recording.
 *
 * @example
 * ```typescript
 * const recordingFile: ScreenRecordingFile = {
 *   path: '/path/to/recording.mp4',
 *   name: 'screen_recording_2024_01_15.mp4',
 *   size: 15728640, // 15MB in bytes
 *   duration: 30.5, // 30.5 seconds
 *   enabledMicrophone: true
 * };
 * ```
 */
export interface ScreenRecordingFile {
  /** Full file system path to the recording */
  path: string;
  /** Display name of the recording file */
  name: string;
  /** File size in bytes */
  size: number;
  /** Recording duration in seconds */
  duration: number;
  /** Whether microphone audio was recorded */
  enabledMicrophone: boolean;
}

/**
 * Error object returned when recording operations fail.
 *
 * @example
 * ```typescript
 * const error: RecordingError = {
 *   name: 'PermissionError',
 *   message: 'Camera permission was denied by user'
 * };
 * ```
 */
export interface RecordingError {
  /** Error type/category name */
  name: string;
  /** Human-readable error description */
  message: string;
}

/**
 * Indicates what happened in a recording lifecycle event.
 *
 * @example
 * ```typescript
 * const reason: RecordingEventReason = 'began'; // Recording started
 * const endReason: RecordingEventReason = 'ended'; // Recording stopped
 * ```
 */
export type RecordingEventReason = 'began' | 'ended';

/**
 * Specifies the type of recording that triggered an event.
 * Note: This type is deprecated but still supported for backwards compatibility.
 *
 * @example
 * ```typescript
 * const eventType: RecordingEventType = 'global'; // Global screen recording
 * const appType: RecordingEventType = 'withinApp'; // In-app recording
 * ```
 */
export type RecordingEventType = 'global' | 'withinApp';

/**
 * Event object emitted during recording lifecycle changes.
 * Provides information about what type of recording changed and how.
 *
 * @example
 * ```typescript
 * const event: ScreenRecordingEvent = {
 *   type: 'global',
 *   reason: 'began'
 * };
 *
 * // Usage in event listener
 * addScreenRecordingListener((event) => {
 *   if (event.reason === 'began') {
 *     console.log(`${event.type} recording started`);
 *   } else {
 *     console.log(`${event.type} recording ended`);
 *   }
 * });
 * ```
 */
export interface ScreenRecordingEvent {
  /** Type of recording (deprecated but still functional) */
  type: RecordingEventType;
  /** What happened to the recording */
  reason: RecordingEventReason;
}
/**
 * @platform ios-only
 * Track the status of the broadcast picker view for fine tuning system recordings.
 */
export type BroadcastPickerPresentationEvent = 'showing' | 'dismissed';

/**
 * Represents a single frame captured during screen recording.
 * Contains the raw pixel data and metadata about the frame.
 *
 * @example
 * ```typescript
 * const frame: ScreenFrame = {
 *   data: new Uint8Array([...]),
 *   width: 1920,
 *   height: 1080,
 *   timestamp: 1234567890,
 *   format: 'RGBA'
 * };
 * ```
 */
export interface ScreenFrame {
  /** Raw pixel data as byte array */
  data: ArrayBuffer;
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Timestamp in milliseconds since recording started */
  timestamp: number;
  /** Pixel format of the frame data */
  format: 'RGBA' | 'BGRA' | 'RGB' | 'YUV';
}

/**
 * Callback function type for receiving frame data during recording.
 * Called for each frame captured during screen recording.
 *
 * @param frame - The captured frame data
 *
 * @example
 * ```typescript
 * const onFrame: FrameCallback = (frame) => {
 *   console.log(`Received frame: ${frame.width}x${frame.height} at ${frame.timestamp}ms`);
 *   // Process frame data...
 * };
 * ```
 */
export type FrameCallback = (frame: ScreenFrame) => void;

/**
 * Configuration options for frame streaming during recording.
 * Allows control over frame rate and quality to balance performance.
 *
 * @example
 * ```typescript
 * const streamConfig: FrameStreamConfig = {
 *   frameRate: 30,
 *   downscaleFactor: 2,
 *   quality: 0.8
 * };
 * ```
 */
export interface FrameStreamConfig {
  /** Frames per second to capture for streaming (default: 30) */
  frameRate?: number;
  /** Factor to downscale resolution (2 = half resolution, default: 1) */
  downscaleFactor?: number;
  /** Compression quality for frame data 0-1 (default: 1.0) */
  quality?: number;
}
