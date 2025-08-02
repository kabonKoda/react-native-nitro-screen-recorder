import assert from 'assert';
import type { ExpoConfig } from '@expo/config-types';
import getEasManagedCredentialsConfigExtra from '../eas/getEasManagedCredentials';
import { ConfigPlugin } from '@expo/config-plugins';
import { ConfigProps } from '../@types';

export const withEasManagedCredentials: ConfigPlugin<ConfigProps> = (
  config
) => {
  assert(
    config.ios?.bundleIdentifier,
    "Missing 'ios.bundleIdentifier' in app config"
  );
  config.extra = getEasManagedCredentialsConfigExtra(config as ExpoConfig);
  return config;
};
