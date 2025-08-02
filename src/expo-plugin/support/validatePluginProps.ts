import { ConfigProps } from '../@types';

const PLUGIN_NAME = 'Nitro Screen Recorder Expo Plugin';

const VALID_PLUGIN_PROP_NAMES: string[] = [
  'enableCameraPermission',
  'cameraPermissionText',
  'enableMicrophonePermission',
  'microphonePermissionText',
  'disableExperimental',
  'showPluginLogs',
];

/**
 * Validate a single props object. Throws on invalid types or unknown properties.
 */
export function validatePluginProps(props: ConfigProps): void {
  if (props == null || typeof props !== 'object') {
    throw new Error(
      `${PLUGIN_NAME}: expected props to be an object, got ${typeof props}`
    );
  }

  if (
    props.enableCameraPermission !== undefined &&
    typeof props.enableCameraPermission !== 'boolean'
  ) {
    throw new Error(
      `${PLUGIN_NAME}: 'enableCameraPermission' must be a boolean.`
    );
  }

  if (
    props.cameraPermissionText !== undefined &&
    typeof props.cameraPermissionText !== 'string'
  ) {
    throw new Error(`${PLUGIN_NAME}: 'cameraPermissionText' must be a string.`);
  }

  if (
    props.enableMicrophonePermission !== undefined &&
    typeof props.enableMicrophonePermission !== 'boolean'
  ) {
    throw new Error(
      `${PLUGIN_NAME}: 'enableMicrophonePermission' must be a boolean.`
    );
  }

  if (
    props.microphonePermissionText !== undefined &&
    typeof props.microphonePermissionText !== 'string'
  ) {
    throw new Error(
      `${PLUGIN_NAME}: 'microphonePermissionText' must be a string.`
    );
  }

  if (
    props.disableExperimental !== undefined &&
    typeof props.disableExperimental !== 'boolean'
  ) {
    throw new Error(`${PLUGIN_NAME}: 'disableExperimental' must be a boolean.`);
  }

  if (
    props.showPluginLogs !== undefined &&
    typeof props.showPluginLogs !== 'boolean'
  ) {
    throw new Error(`${PLUGIN_NAME}: 'showPluginLogs' must be a boolean.`);
  }

  const invalidKeys = Object.keys(props).filter(
    (k) => !VALID_PLUGIN_PROP_NAMES.includes(k)
  );
  if (invalidKeys.length > 0) {
    throw new Error(
      `${PLUGIN_NAME}: invalid propert${
        invalidKeys.length === 1 ? 'y' : 'ies'
      } ${invalidKeys.map((p) => `"${p}"`).join(', ')} provided.`
    );
  }
}
