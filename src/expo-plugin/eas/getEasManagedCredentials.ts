import { BE_TARGET_NAME, getAppGroup } from '../support/iosConstants';
import { ExpoConfig } from '@expo/config-types';

export default function getEasManagedCredentialsConfigExtra(
  config: ExpoConfig
): { [k: string]: any } {
  return {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions ??
                []),
              {
                targetName: BE_TARGET_NAME,
                bundleIdentifier: `${config?.ios?.bundleIdentifier}.${BE_TARGET_NAME}`,
                entitlements: {
                  'com.apple.security.application-groups': [
                    getAppGroup(config?.ios?.bundleIdentifier!),
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };
}
