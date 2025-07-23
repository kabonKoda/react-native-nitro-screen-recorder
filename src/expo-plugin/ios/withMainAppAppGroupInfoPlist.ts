import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../constants';

export const withMainAppAppGroupInfoPlist: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) => {
  return withInfoPlist(config, (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier!;
    const appGroup = getAppGroup(appIdentifier, props);
    modConfig.modResults.AppGroupIdentifier = appGroup;
    return modConfig;
  });
};
