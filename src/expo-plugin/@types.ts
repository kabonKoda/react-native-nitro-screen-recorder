export interface ConfigProps {
  /**
   * Camera permission description text for iOS
   * @default "Allow $(PRODUCT_NAME) to access your camera for screen recording with camera overlay"
   */
  cameraPermissionText?: string;

  /**
   * Whether to enable microphone permission
   * @default true
   */
  enableMicrophonePermission?: boolean;

  /**
   * Microphone permission description text for iOS
   * @default "Allow $(PRODUCT_NAME) to access your microphone for screen recording with audio"
   */
  microphonePermissionText?: string;

  /**
   * Photo library permission description text for iOS
   * @default "Allow $(PRODUCT_NAME) to save recorded videos to your photo library"
   */
  photoLibraryPermissionText?: string;
  /**
   * Whether to enable system-wide recording permissions (Android)
   * @default false
   */
  systemWideRecording?: boolean;
}
