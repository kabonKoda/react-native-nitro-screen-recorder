import { ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../constants';

export const withMainAppAppGroupEntitlement: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) => {
  return withEntitlementsPlist(config, async (modConfig) => {
    const appIdentifier = modConfig.ios?.bundleIdentifier!;
    modConfig.modResults['com.apple.security.application-groups'] = [
      getAppGroup(appIdentifier, props),
    ];
    return modConfig;
  });
};
