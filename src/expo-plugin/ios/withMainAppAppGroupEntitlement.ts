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
    // Ensure we have an array, preserving any existing entries
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      newConfig.modResults[APP_GROUP_KEY] = [];
    }

    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<any>;
    const entitlement = getAppGroup(newConfig?.ios?.bundleIdentifier!);

    console.log('hit with', entitlement);

    // Check if our entitlement already exists
    if (modResultsArray.includes(entitlement)) {
      console.log('found - skipping');
      return newConfig;
    }

    console.log('pushing', entitlement);
    modResultsArray.push(entitlement);

    // Log final state for debugging
    console.log('Final app groups:', modResultsArray);

    return newConfig;
  });
};
