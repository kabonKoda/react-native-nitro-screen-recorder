import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';
import assert from 'assert';

export const withMainAppAppGroupInfoPlist: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withInfoPlist(config, (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier;
    assert(appIdentifier, "Missing 'ios.bundleIdentifier' in app config");
    const appGroup = getAppGroup(appIdentifier, props);

    // Use a specific key to avoid conflicts
    modConfig.modResults.BroadcastExtensionAppGroupIdentifier = appGroup;

    return modConfig;
  });
};
