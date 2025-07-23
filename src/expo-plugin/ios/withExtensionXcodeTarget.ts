import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

import {
  getBroadcastExtensionName,
  getBroadcastExtensionSetupUIName,
  getBroadcastExtensionBundleIdentifier,
  getBroadcastExtensionSetupUIBundleIdentifier,
} from '../constants';
import {
  writeBroadcastExtensionFiles,
  getBroadcastExtensionInfoFilePath,
  getBroadcastExtensionEntitlementsFilePath,
  getBroadcastExtensionSetupUIInfoFilePath,
  getBroadcastExtensionSetupUIEntitlementsFilePath,
  getMainExtensionPrivacyInfoFilePath,
  getSetupUIPrivacyInfoFilePath,
  getBroadcastExtensionSampleHandlerPath,
  getBroadcastExtensionSetupUIViewControllerPath,
  getBroadcastExtensionStoryboardFilePath,
} from './writeBroadcastExtensionFiles';
import { ConfigProps } from '../@types';

// Helper to convert absolute paths into project-relative paths for Xcode
function makeRelative(absPath: string, projectRoot: string) {
  return path.relative(projectRoot, absPath).replace(/\\/g, '/');
}

export const withBroadcastExtensionXcodeTarget: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  console.log('[withBroadcastExtension] plugin invoked');
  return withXcodeProject(config, async (mod) => {
    console.log('[withBroadcastExtension] withXcodeProject callback');

    const extensionName = getBroadcastExtensionName(props);
    const setupUIName = getBroadcastExtensionSetupUIName(props);
    const projectRoot = mod.modRequest.platformProjectRoot;
    const scheme = mod.scheme! as string;
    const appIdentifier = mod.ios?.bundleIdentifier!;
    const bundleIdentifier = getBroadcastExtensionBundleIdentifier(
      appIdentifier,
      props
    );
    const setupUIBundleIdentifier =
      getBroadcastExtensionSetupUIBundleIdentifier(appIdentifier, props);
    const currentProjectVersion = mod.ios!.buildNumber || '1';
    const marketingVersion = mod.version!;

    console.log('[withBroadcastExtension] identifiers:', {
      extensionName,
      setupUIName,
      projectRoot,
      scheme,
      appIdentifier,
      bundleIdentifier,
      setupUIBundleIdentifier,
    });

    // Write all extension files to disk
    console.log('[withBroadcastExtension] writing extension files');
    await writeBroadcastExtensionFiles(
      projectRoot,
      scheme,
      appIdentifier,
      props,
      mod.name
    );
    console.log(
      '[withBroadcastExtension] writeBroadcastExtensionFiles complete'
    );

    const pbx = mod.modResults;
    console.log('[withBroadcastExtension] loaded PBX project');

    // MAIN EXTENSION TARGET
    if (!pbx.pbxTargetByName(extensionName)) {
      console.log(`Adding target: ${extensionName}`);
      const target = pbx.addTarget(
        extensionName,
        'app_extension',
        extensionName
      );
      pbx.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      const groupKey = pbx.pbxCreateGroup(extensionName, extensionName);
      console.log(`  groupKey: ${groupKey}`);

      // Info.plist
      const infoRel = makeRelative(
        getBroadcastExtensionInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Info.plist: ${infoRel}`);
      pbx.addFile(infoRel, groupKey);

      // Entitlements
      const entRel = makeRelative(
        getBroadcastExtensionEntitlementsFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Entitlements: ${entRel}`);
      pbx.addFile(entRel, groupKey);

      // Privacy (.xcprivacy) - use addFile instead of addResourceFile
      const privRel = makeRelative(
        getMainExtensionPrivacyInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Privacy: ${privRel}`);
      console.log(
        '    exists on disk:',
        fs.existsSync(path.join(projectRoot, privRel))
      );
      try {
        pbx.addFile(privRel, groupKey);
        console.log('  -> added PrivacyInfo.xcprivacy');
      } catch (e) {
        console.error('Error adding PrivacyInfo.xcprivacy:', e);
        console.error('    file:', privRel);
        console.error('    groupKey:', groupKey);
        throw e;
      }

      // SampleHandler.swift
      const handlerRel = makeRelative(
        getBroadcastExtensionSampleHandlerPath(projectRoot, props),
        projectRoot
      );
      console.log(`  SampleHandler: ${handlerRel}`);
      // use addSourceFile to attach code to the target
      pbx.addSourceFile(handlerRel, { target: target.uuid }, groupKey);

      // Storyboard (optional)
      try {
        const sbRel = makeRelative(
          getBroadcastExtensionStoryboardFilePath(projectRoot, props),
          projectRoot
        );
        console.log(`  Storyboard: ${sbRel}`);
        // use addResourceFile for storyboards
        pbx.addResourceFile(sbRel, { target: target.uuid }, groupKey);
      } catch {
        console.log('  No storyboard found');
      }

      // Storyboard (optional)
      try {
        const sbRel = makeRelative(
          getBroadcastExtensionStoryboardFilePath(projectRoot, props),
          projectRoot
        );
        console.log(`  Storyboard: ${sbRel}`);
        pbx.addFile(sbRel, { target: target.uuid });
      } catch {
        console.log('  No storyboard found');
      }
    } else {
      console.log(`Target ${extensionName} already exists`);
    }

    // SETUP UI EXTENSION TARGET
    if (!pbx.pbxTargetByName(setupUIName)) {
      console.log(`Adding setup UI target: ${setupUIName}`);
      const setupTarget = pbx.addTarget(
        setupUIName,
        'app_extension',
        setupUIName
      );
      pbx.addBuildPhase(
        [],
        'PBXSourcesBuildPhase',
        'Sources',
        setupTarget.uuid
      );
      pbx.addBuildPhase(
        [],
        'PBXResourcesBuildPhase',
        'Resources',
        setupTarget.uuid
      );
      const setupGroupKey = pbx.pbxCreateGroup(setupUIName, setupUIName);
      console.log(`  setupGroupKey: ${setupGroupKey}`);

      // Setup UI Info.plist
      const setupInfoRel = makeRelative(
        getBroadcastExtensionSetupUIInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Setup UI Info.plist: ${setupInfoRel}`);
      pbx.addFile(setupInfoRel, setupGroupKey);

      // Setup UI entitlements
      const setupEntRel = makeRelative(
        getBroadcastExtensionSetupUIEntitlementsFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Setup UI Entitlements: ${setupEntRel}`);
      pbx.addFile(setupEntRel, setupGroupKey);

      // Setup UI Privacy (.xcprivacy)
      const setupPrivRel = makeRelative(
        getSetupUIPrivacyInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Setup UI Privacy: ${setupPrivRel}`);
      console.log(
        '    exists on disk:',
        fs.existsSync(path.join(projectRoot, setupPrivRel))
      );
      try {
        pbx.addFile(setupPrivRel, setupGroupKey);
        console.log('  -> added Setup UI PrivacyInfo.xcprivacy');
      } catch (e) {
        console.error('Error adding Setup UI PrivacyInfo.xcprivacy:', e);
        console.error('    file:', setupPrivRel);
        console.error('    setupGroupKey:', setupGroupKey);
        throw e;
      }

      // BroadcastSetupViewController.swift
      const vcRel = makeRelative(
        getBroadcastExtensionSetupUIViewControllerPath(projectRoot, props),
        projectRoot
      );
      console.log(`  ViewController: ${vcRel}`);
      // use addSourceFile for view controller code
      pbx.addSourceFile(vcRel, { target: setupTarget.uuid }, setupGroupKey);

      // Storyboard (optional)
      try {
        const sbRel = makeRelative(
          getBroadcastExtensionStoryboardFilePath(projectRoot, props),
          projectRoot
        );
        console.log(`  Setup UI Storyboard: ${sbRel}`);
        // use addResourceFile for storyboards
        pbx.addResourceFile(sbRel, { target: setupTarget.uuid }, setupGroupKey);
      } catch {
        console.log('  No setup UI storyboard found');
      }

      // Storyboard (optional)
      try {
        const sbRel = makeRelative(
          getBroadcastExtensionStoryboardFilePath(projectRoot, props),
          projectRoot
        );
        console.log(`  Setup UI Storyboard: ${sbRel}`);
        pbx.addFile(sbRel, { target: setupTarget.uuid });
      } catch {
        console.log('  No setup UI storyboard found');
      }
    } else {
      console.log(`Setup UI target ${setupUIName} already exists`);
    }

    // Configure build settings
    console.log('[withBroadcastExtension] configuring build settings');
    const configs = pbx.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      const bs = configs[key].buildSettings;
      if (!bs || !bs.PRODUCT_NAME) continue;

      if (bs.PRODUCT_NAME === `"${extensionName}"`) {
        console.log(`  Applying build settings for ${extensionName}`);
        bs.CLANG_ENABLE_MODULES = 'YES';
        bs.INFOPLIST_FILE = `"${makeRelative(
          getBroadcastExtensionInfoFilePath(projectRoot, props),
          projectRoot
        )}"`;
        bs.CODE_SIGN_ENTITLEMENTS = `"${makeRelative(
          getBroadcastExtensionEntitlementsFilePath(projectRoot, props),
          projectRoot
        )}"`;
        bs.CODE_SIGN_STYLE = 'Automatic';
        bs.CURRENT_PROJECT_VERSION = `"${currentProjectVersion}"`;
        bs.GENERATE_INFOPLIST_FILE = 'YES';
        bs.MARKETING_VERSION = `"${marketingVersion}"`;
        bs.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleIdentifier}"`;
        bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
        bs.SWIFT_VERSION = '5.0';
        bs.TARGETED_DEVICE_FAMILY = '"1,2"';
      }

      if (bs.PRODUCT_NAME === `"${setupUIName}"`) {
        console.log(`  Applying build settings for ${setupUIName}`);
        bs.CLANG_ENABLE_MODULES = 'YES';
        bs.INFOPLIST_FILE = `"${makeRelative(
          getBroadcastExtensionSetupUIInfoFilePath(projectRoot, props),
          projectRoot
        )}"`;
        bs.CODE_SIGN_ENTITLEMENTS = `"${makeRelative(
          getBroadcastExtensionSetupUIEntitlementsFilePath(projectRoot, props),
          projectRoot
        )}"`;
        bs.CODE_SIGN_STYLE = 'Automatic';
        bs.CURRENT_PROJECT_VERSION = `"${currentProjectVersion}"`;
        bs.GENERATE_INFOPLIST_FILE = 'YES';
        bs.MARKETING_VERSION = `"${marketingVersion}"`;
        bs.PRODUCT_BUNDLE_IDENTIFIER = `"${setupUIBundleIdentifier}"`;
        bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
        bs.SWIFT_VERSION = '5.0';
        bs.TARGETED_DEVICE_FAMILY = '"1,2"';
      }
    }

    console.log(
      '[withBroadcastExtension] Xcode project modifications complete'
    );
    return mod;
  });
};
