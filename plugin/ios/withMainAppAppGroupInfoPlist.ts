import { type ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import type { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';
import { getBroadcastExtensionBundleIdentifier } from '../support/iosConstants';
import assert from 'assert';

export const withMainAppAppGroupInfoPlist: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withInfoPlist(config, (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier;
    assert(appIdentifier, "Missing 'ios.bundleIdentifier' in app config");
    const appGroup = getAppGroup(appIdentifier, props);
    const broadcastExtensionBundleId = getBroadcastExtensionBundleIdentifier(
      appIdentifier,
      props
    );

    modConfig.modResults.BroadcastExtensionAppGroupIdentifier = appGroup;
    modConfig.modResults.BroadcastExtensionBundleIdentifier =
      broadcastExtensionBundleId;

    return modConfig;
  });
};
