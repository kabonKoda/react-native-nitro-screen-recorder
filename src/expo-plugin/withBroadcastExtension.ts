import {
  withPlugins,
  ConfigPlugin,
  withDangerousMod,
} from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';
import { ConfigProps } from './@types';
import {
  broadcastExtensionSampleHandlerFileName,
  broadcastExtensionSetupUIViewControllerFileName,
  getBroadcastExtensionBundleIdentifier,
  getBroadcastExtensionName,
  getBroadcastExtensionSetupUIBundleIdentifier,
  getBroadcastExtensionSetupUIName,
} from './constants';

/**
 * withBroadcastExtension plugin
 *
 * Requirements:
 * - This plugin will generate the files here:
 *     ios/
 *       BroadcastExtension/
 *         SampleHandler.swift
 *       BroadcastExtensionSetupUI/
 *         BroadcastSetupViewController.swift
 *
 * - The plugin expects these Swift files to be present at those paths.
 * - When `enableGlobalRecording` is true, this plugin will:
 *     1. Copy SampleHandler.swift into the project's Broadcast Extension target.
 *     2. Generate the Broadcast Extension Info.plist with correct CFBundleIdentifier & NSExtension keys.
 *     3. Copy BroadcastSetupViewController.swift into the project's Setup UI Extension target.
 *     4. Generate the Setup UI Extension Info.plist with correct CFBundleIdentifier & NSExtension keys.
 *
 * Structure:
 * - withBroadcastSampleHandler: copies SampleHandler.swift
 * - withBroadcastExtensionPlist: creates Broadcast Extension Info.plist
 * - withBroadcastSetupUISwift: copies BroadcastSetupViewController.swift
 * - withBroadcastSetupUIPlist: creates Setup UI Extension Info.plist
 * - withBroadcastExtension: composes the above when enabled
 */

// Use the same directory as the plugin file for Swift templates
const BROADCAST_DIR = __dirname;

/**
 * Copies SampleHandler.swift into the app's Broadcast Extension target folder.
 */
const withBroadcastSampleHandler: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const sourcePath = path.join(
        BROADCAST_DIR,
        broadcastExtensionSampleHandlerFileName
      );
      const extensionName = getBroadcastExtensionName(props);
      const dest = path.join(
        modConfig.modRequest.projectRoot,
        'ios',
        extensionName,
        broadcastExtensionSampleHandlerFileName
      );

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Required Swift template not found: ${sourcePath}`);
      }

      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(sourcePath, dest);
      return modConfig;
    },
  ]);

/**
 * Injects a minimal Info.plist into the Broadcast Extension.
 */
const withBroadcastExtensionPlist: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const baseBundleId = modConfig.ios!.bundleIdentifier!.replace(
        /\.example$/,
        ''
      );
      const extensionName = getBroadcastExtensionName(props);
      const extId = getBroadcastExtensionBundleIdentifier(baseBundleId, props);
      const extDir = path.join(
        modConfig.modRequest.projectRoot,
        'ios',
        extensionName
      );

      const plistPath = path.join(extDir, 'Info.plist');

      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>BroadcastExtension</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>${extId}</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.broadcast-services-upload</string>
		<key>NSExtensionPrincipalClass</key>
		<string>SampleHandler</string>
	</dict>
</dict>
</plist>`;

      await fs.promises.mkdir(extDir, { recursive: true });
      await fs.promises.writeFile(plistPath, plistContent);
      return modConfig;
    },
  ]);

/**
 * Copies BroadcastSetupViewController.swift into the Setup UI Extension.
 */
const withBroadcastSetupUISwift: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const sourcePath = path.join(
        BROADCAST_DIR,
        broadcastExtensionSetupUIViewControllerFileName
      );
      const setupUIName = getBroadcastExtensionSetupUIName(props);
      const dest = path.join(
        modConfig.modRequest.projectRoot,
        'ios',
        setupUIName,
        broadcastExtensionSetupUIViewControllerFileName
      );

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Required Swift template not found: ${sourcePath}`);
      }

      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(sourcePath, dest);
      return modConfig;
    },
  ]);

/**
 * Injects a minimal Info.plist into the Setup UI Extension.
 */
const withBroadcastSetupUIPlist: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const baseBundleId = modConfig.ios!.bundleIdentifier!.replace(
        /\.example$/,
        ''
      );
      const setupUIName = getBroadcastExtensionSetupUIName(props);
      const uiId = getBroadcastExtensionSetupUIBundleIdentifier(
        baseBundleId,
        props
      );
      const uiDir = path.join(
        modConfig.modRequest.projectRoot,
        'ios',
        setupUIName
      );

      const plistPath = path.join(uiDir, 'Info.plist');

      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>BroadcastExtensionSetupUI</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>${uiId}</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.broadcast-services-upload-ui</string>
		<key>NSExtensionPrincipalClass</key>
		<string>BroadcastSetupViewController</string>
	</dict>
</dict>
</plist>`;

      await fs.promises.mkdir(uiDir, { recursive: true });
      await fs.promises.writeFile(plistPath, plistContent);
      return modConfig;
    },
  ]);

/**
 * Compose all four plugins into one. Only applies when enabled.
 */
export const withBroadcastExtension: ConfigPlugin<
  ConfigProps & { enabled?: boolean }
> = (config, props = {}) => {
  if (!props.enableGlobalRecording) {
    return config;
  }
  return withPlugins(config, [
    [withBroadcastSampleHandler, props],
    [withBroadcastExtensionPlist, props],
    [withBroadcastSetupUISwift, props],
    [withBroadcastSetupUIPlist, props],
  ]);
};
