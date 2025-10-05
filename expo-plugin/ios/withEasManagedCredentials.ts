import type { ExpoConfig } from '@expo/config-types';
import getEasManagedCredentialsConfigExtra from '../eas/getEasManagedCredentials';
import { type ConfigPlugin } from '@expo/config-plugins';
import { type ConfigProps } from '../@types';

export const withEasManagedCredentials: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  config.extra = getEasManagedCredentialsConfigExtra(
    config as ExpoConfig,
    props
  );
  return config;
};
