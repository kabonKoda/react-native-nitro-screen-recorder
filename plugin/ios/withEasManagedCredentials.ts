import type { ExpoConfig } from '@expo/config-types';
import getEasManagedCredentialsConfigExtra from '../eas/getEasManagedCredentials';
import { ConfigPlugin } from '@expo/config-plugins';
import { ConfigProps } from '../@types';

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
