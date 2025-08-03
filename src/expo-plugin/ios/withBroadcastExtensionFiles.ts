import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

import {
  BROADCAST_EXT_TARGET_NAME,
  BROADCAST_EXT_ALL_FILES,
  DEFAULT_BUNDLE_VERSION,
  DEFAULT_BUNDLE_SHORT_VERSION,
  getAppGroup,
} from '../support/iosConstants';
import { FileManager } from '../support/FileManager';
import BEUpdaterManager from '../support/BEUpdateManager';
import { ScreenRecorderLog } from '../support/ScreenRecorderLog';
import { ConfigProps } from '../@types';

const SAMPLE_HANDLER_FILE = 'SampleHandler.swift';
/**
 * Copies the ReplayKit Broadcast Upload Extension templates into the iOS
 * project and patches them so their App Group + bundle versions match the
 * host app. Mirrors OneSignal's NSE flow for consistency.
 */
export const withBroadcastExtensionFiles: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const iosPath = path.join(mod.modRequest.projectRoot, 'ios');

      const sourceDir = path.join(
        __dirname,
        '..',
        'support',
        'broadcastExtensionFiles'
      );

      fs.mkdirSync(`${iosPath}/${BROADCAST_EXT_TARGET_NAME}`, {
        recursive: true,
      });

      for (const extFile of BROADCAST_EXT_ALL_FILES) {
        const targetFile = `${iosPath}/${BROADCAST_EXT_TARGET_NAME}/${extFile}`;
        await FileManager.copyFile(`${sourceDir}/${extFile}`, targetFile);
      }

      const sourceSamplePath = `${sourceDir}/${SAMPLE_HANDLER_FILE}`;
      const targetSamplePath = `${iosPath}/${BROADCAST_EXT_TARGET_NAME}/${SAMPLE_HANDLER_FILE}`;
      await FileManager.copyFile(sourceSamplePath, targetSamplePath);

      ScreenRecorderLog.log(
        `Copied broadcast extension files to ${iosPath}/${BROADCAST_EXT_TARGET_NAME}`
      );
      /* ------------------------------------------------------------ */
      /* 2️⃣  Patch entitlements & Info.plist placeholders              */
      /* ------------------------------------------------------------ */
      const updater = new BEUpdaterManager(iosPath);
      const mainAppBundleId = mod.ios?.bundleIdentifier;
      if (!mainAppBundleId) {
        throw new Error('Failed to find main app bundle id!');
      }
      const groupIdentifier = getAppGroup(mainAppBundleId, props);

      await updater.updateEntitlements(groupIdentifier);
      await updater.updateInfoPlist(
        mod.ios?.buildNumber ?? DEFAULT_BUNDLE_VERSION,
        groupIdentifier
      );
      await updater.updateBundleShortVersion(
        mod.version ?? DEFAULT_BUNDLE_SHORT_VERSION
      );

      ScreenRecorderLog.log(
        'Patched broadcast extension entitlements and Info.plist with app group and version values.'
      );

      return mod;
    },
  ]);
};
