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
    modConfig.modResults.AppGroupIdentifier = appGroup;
    return modConfig;
  });
};
