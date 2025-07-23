import { withPlugins, ConfigPlugin } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { withMainAppAppGroupEntitlement } from './withMainAppAppGroupEntitlement';
import { withMainAppAppGroupInfoPlist } from './withMainAppAppGroupInfoPlist';
import { withBroadcastExtensionXcodeTarget } from './withExtensionXcodeTarget';
import { withBroadcastExtensionConfig } from './withBroadcastExtensionConfig';

export const withBroadcastExtension: ConfigPlugin<
  ConfigProps & { enabled?: boolean }
> = (config, props = {}) => {
  if (!props.enableGlobalRecording) {
    return config;
  }
  return withPlugins(config, [
    [withMainAppAppGroupInfoPlist, props],
    [withMainAppAppGroupEntitlement, props],
    [withBroadcastExtensionConfig, props],
    [withBroadcastExtensionXcodeTarget, props],
  ]);
};
