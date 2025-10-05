import { type ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import type { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';
import assert from 'assert';
/**
 * Add "App Group" permission
 */
export const withMainAppAppGroupEntitlement: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  const APP_GROUP_KEY = 'com.apple.security.application-groups';
  return withEntitlementsPlist(config, (newConfig) => {
    // Ensure we have an array, preserving any existing entries
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      newConfig.modResults[APP_GROUP_KEY] = [];
    }

    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<any>;
    assert(
      newConfig.ios?.bundleIdentifier,
      "Missing 'ios.bundleIdentifier' in app config"
    );
    const entitlement = getAppGroup(newConfig?.ios?.bundleIdentifier, props);

    // Check if our entitlement already exists
    if (modResultsArray.includes(entitlement)) {
      return newConfig;
    }
    modResultsArray.push(entitlement);
    return newConfig;
  });
};
