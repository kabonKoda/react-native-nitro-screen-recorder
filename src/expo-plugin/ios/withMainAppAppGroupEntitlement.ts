import { ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { getAppGroup } from '../support/iosConstants';

/**
 * Add "App Group" permission with extensive debugging
 */
export const withMainAppAppGroupEntitlement: ConfigPlugin<ConfigProps> = (
  config
) => {
  const APP_GROUP_KEY = 'com.apple.security.application-groups';

  return withEntitlementsPlist(config, (newConfig) => {
    const timestamp = new Date().toISOString();
    console.log(
      `\n🔧 [${timestamp}] SCREEN RECORDER: Starting entitlements modification`
    );
    console.log(
      '🔧 SCREEN RECORDER: Bundle ID:',
      newConfig?.ios?.bundleIdentifier
    );

    // Log the current state of ALL entitlements
    console.log(
      '🔧 SCREEN RECORDER: Current entitlements keys:',
      Object.keys(newConfig.modResults)
    );
    console.log(
      '🔧 SCREEN RECORDER: Current app groups:',
      newConfig.modResults[APP_GROUP_KEY]
    );
    console.log(
      '🔧 SCREEN RECORDER: App groups type:',
      typeof newConfig.modResults[APP_GROUP_KEY]
    );
    console.log(
      '🔧 SCREEN RECORDER: Is array?:',
      Array.isArray(newConfig.modResults[APP_GROUP_KEY])
    );

    // Ensure we have an array
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      console.log('🔧 SCREEN RECORDER: Creating new app groups array');
      newConfig.modResults[APP_GROUP_KEY] = [];
    }

    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<any>;
    const entitlement = getAppGroup(newConfig?.ios?.bundleIdentifier!);

    console.log('🔧 SCREEN RECORDER: Target entitlement:', entitlement);
    console.log(
      '🔧 SCREEN RECORDER: Current array contents:',
      JSON.stringify(modResultsArray, null, 2)
    );

    // Check if our entitlement already exists
    const alreadyExists = modResultsArray.includes(entitlement);
    console.log('🔧 SCREEN RECORDER: Already exists?', alreadyExists);

    if (alreadyExists) {
      console.log('🔧 SCREEN RECORDER: Entitlement already exists - skipping');
      return newConfig;
    }

    console.log('🔧 SCREEN RECORDER: Adding entitlement to array');
    modResultsArray.push(entitlement);

    // Verify it was added
    console.log(
      '🔧 SCREEN RECORDER: Array after push:',
      JSON.stringify(modResultsArray, null, 2)
    );
    console.log(
      '🔧 SCREEN RECORDER: Final entitlements object:',
      JSON.stringify(newConfig.modResults, null, 2)
    );
    console.log('🔧 SCREEN RECORDER: ✅ Entitlements modification complete\n');

    return newConfig;
  });
};
