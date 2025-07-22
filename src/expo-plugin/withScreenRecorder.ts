import {
  withPlugins,
  createRunOncePlugin,
  AndroidConfig,
} from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import type { ConfigProps } from './@types';
import { withBroadcastExtension } from './withBroadcastExtension';

const pkg: { name: string; version: string } = require('../../../package.json');

const CAMERA_USAGE = 'Allow $(PRODUCT_NAME) to access your camera';
const MICROPHONE_USAGE = 'Allow $(PRODUCT_NAME) to access your microphone';

const withScreenRecorder: ConfigPlugin<ConfigProps> = (config, props = {}) => {
  /*---------------IOS-------------------- */
  if (config.ios == null) config.ios = {};
  if (config.ios.infoPlist == null) config.ios.infoPlist = {};

  config.ios.infoPlist.NSCameraUsageDescription =
    props.cameraPermissionText ??
    (config.ios.infoPlist.NSCameraUsageDescription as string | undefined) ??
    CAMERA_USAGE;

  if (props.enableMicrophonePermission !== false) {
    config.ios.infoPlist.NSMicrophoneUsageDescription =
      props.microphonePermissionText ??
      (config.ios.infoPlist.NSMicrophoneUsageDescription as
        | string
        | undefined) ??
      MICROPHONE_USAGE;
  }

  if (props.enableGlobalRecording) {
    config = withBroadcastExtension(config, props);
  }

  /*---------------ANDROID-------------------- */
  const androidPermissions = ['android.permission.CAMERA'];
  if (props.enableMicrophonePermission !== false) {
    androidPermissions.push('android.permission.RECORD_AUDIO');
  }

  return withPlugins(config, [
    [AndroidConfig.Permissions.withPermissions, androidPermissions],
  ]);
};

export default createRunOncePlugin(withScreenRecorder, pkg.name, pkg.version);
