import { BE_TARGET_NAME } from '../support/iosConstants';
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
                // keep in sync with native changes in NSE
                targetName: BE_TARGET_NAME,
                bundleIdentifier: `${config?.ios?.bundleIdentifier}.${BE_TARGET_NAME}`,
                entitlements: {
                  'com.apple.security.application-groups': [
                    `group.${config?.ios?.bundleIdentifier}.screen-recorder`,
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
