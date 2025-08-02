import { ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';

/**
 * Add "App Group" permission
 */
export const withMainAppAppGroupEntitlement: ConfigPlugin<ConfigProps> = (
  config
) => {
  const APP_GROUP_KEY = 'com.apple.security.application-groups';
  return withEntitlementsPlist(config, (newConfig) => {
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      newConfig.modResults[APP_GROUP_KEY] = [];
    }
    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<any>;
    const entitlement = getAppGroup(newConfig?.ios?.bundleIdentifier!);
    if (modResultsArray.indexOf(entitlement) !== -1) {
      return newConfig;
    }
    modResultsArray.push(entitlement);
    return newConfig;
  });
};
