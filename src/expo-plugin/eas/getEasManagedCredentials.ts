import { ConfigProps } from '../@types';
import {
  BE_TARGET_NAME,
  getAppGroup,
  getBroadcastExtensionBundleIdentifier,
} from '../support/iosConstants';
import { ExpoConfig } from '@expo/config-types';
import assert from 'assert';

export default function getEasManagedCredentialsConfigExtra(
  config: ExpoConfig,
  props: ConfigProps
): { [k: string]: any } {
  const providedExtensionBundleId = !!props.iosExtensionBundleIdentifier;
  if (!providedExtensionBundleId && !config.ios?.bundleIdentifier) {
    assert(
      config.ios?.bundleIdentifier,
      "Missing 'ios.bundleIdentifier' in app config"
    );
  }

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
                bundleIdentifier: getBroadcastExtensionBundleIdentifier(
                  config?.ios?.bundleIdentifier!,
                  props
                ),
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
