import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';

export const withMainAppAppGroupInfoPlist: ConfigPlugin<ConfigProps> = (
  config
) => {
  return withInfoPlist(config, (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier!;
    const appGroup = getAppGroup(appIdentifier);
    modConfig.modResults.AppGroupIdentifier = appGroup;
    return modConfig;
  });
};
