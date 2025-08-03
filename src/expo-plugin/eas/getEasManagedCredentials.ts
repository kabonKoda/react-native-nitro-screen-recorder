import { ConfigProps } from '../@types';
import { BE_TARGET_NAME, getAppGroup } from '../support/iosConstants';
import { ExpoConfig } from '@expo/config-types';
import assert from 'assert';

export default function getEasManagedCredentialsConfigExtra(
  config: ExpoConfig,
  props: ConfigProps
): { [k: string]: any } {
  assert(
    config.ios?.bundleIdentifier,
    "Missing 'ios.bundleIdentifier' in app config"
  );
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
                    getAppGroup(config?.ios?.bundleIdentifier!, props),
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
