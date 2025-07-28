import { ConfigPlugin } from '@expo/config-plugins';

import {
  broadcastExtensionName,
  getBroadcastExtensionBundleIdentifier,
} from '../constants';
import { getBroadcastExtensionEntitlements } from './writeBroadcastExtensionFiles';
import { ConfigProps } from '../@types';
import { makePluginLogger } from './PluginLogger';

export const withBroadcastExtensionConfig: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  const l = makePluginLogger(props.showPluginLogs ?? false);
  const extName = broadcastExtensionName;
  const appIdentifier = config.ios!.bundleIdentifier!;
  const extIdentifier = getBroadcastExtensionBundleIdentifier(appIdentifier);

  // When disabled this function no longer alters the config object passed to it
  // It only returns the original config to satisfy any calling conventions
  if (!props.disableExperimental) {
    l.info('Applying Expo experimental appExtensions.');
    let extConfigIndex = null;
    config.extra?.eas?.build?.experimental?.ios?.appExtensions?.forEach(
      (ext: any, index: number) => {
        ext.targetName === extName && (extConfigIndex = index);
      }
    );

    if (!config.extra) {
      config.extra = {};
    }

    if (!extConfigIndex) {
      if (!config.extra.eas) {
        config.extra.eas = {};
      }
      if (!config.extra.eas.build) {
        config.extra.eas.build = {};
      }
      if (!config.extra.eas.build.experimental) {
        config.extra.eas.build.experimental = {};
      }
      if (!config.extra.eas.build.experimental.ios) {
        config.extra.eas.build.experimental.ios = {};
      }
      if (!config.extra.eas.build.experimental.ios.appExtensions) {
        config.extra.eas.build.experimental.ios.appExtensions = [];
      }
      config.extra.eas.build.experimental.ios.appExtensions.push({
        targetName: extName,
        bundleIdentifier: extIdentifier,
      });
      extConfigIndex =
        config.extra.eas.build.experimental.ios.appExtensions.length - 1;
    }

    const extConfig =
      config.extra.eas.build.experimental.ios.appExtensions[extConfigIndex];
    extConfig.entitlements = {
      ...extConfig.entitlements,
      ...getBroadcastExtensionEntitlements(appIdentifier, props),
    };
  } else {
    l.info('Skipping Expo experimental appExtensions.');
  }

  return config;
};
