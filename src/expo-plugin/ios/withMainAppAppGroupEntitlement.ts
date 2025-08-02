import { ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';

export const withMainAppAppGroupEntitlement: ConfigPlugin<ConfigProps> = (
  config
) => {
  return withEntitlementsPlist(config, async (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier!;
    modConfig.modResults['com.apple.security.application-groups'] = [
      getAppGroup(appIdentifier),
    ];
    return modConfig;
  });
};
