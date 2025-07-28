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
  /*
   *
   * @default false
   * @example true
   */
  disableExperimental?: boolean;
  // /**
  //  * Photo library permission description text for iOS
  //  * @default "Allow $(PRODUCT_NAME) to save recorded videos to your photo library"
  //  */
  // photoLibraryPermissionText: string;
  /**
   * Whether to enable global screen recording (records even when the app is backgrounded)
   * @default false
   * @example true
   */
  enableGlobalRecording?: boolean;

  /**
   * App Group identifier used to share data between the app and its extensions
   * @default `group.$\{PRODUCT_BUNDLE_IDENTIFIER\}.screenrecording`
   * @example "group.com.mycompany.myapp.screenrecording"
   */
  iosAppGroupIdentifier?: string;
  /**
   * A flag that hides logs for the plugin.
   */
  showPluginLogs?: boolean;
}
