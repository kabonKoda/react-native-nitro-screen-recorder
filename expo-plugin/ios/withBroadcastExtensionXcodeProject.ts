import { type ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import {
  BROADCAST_EXT_SOURCE_FILES,
  TARGETED_DEVICE_FAMILY,
  DEFAULT_BUNDLE_VERSION,
  DEFAULT_BUNDLE_SHORT_VERSION,
  getBroadcastExtensionBundleIdentifier,
  getBroadcastExtensionTargetName,
  BROADCAST_EXT_ALL_FILES,
} from '../support/iosConstants';
import { type ConfigProps } from '../@types';
import { ScreenRecorderLog } from '../support/ScreenRecorderLog';
import assert from 'assert';
//───────────────────────────────────────────────────────────────────────────
// Helper: pull DEVELOPMENT_TEAM from the main-app target’s build settings
//───────────────────────────────────────────────────────────────────────────
function getMainAppDevelopmentTeam(
  pbx: any,
  l: typeof ScreenRecorderLog
): string | null {
  const configs = pbx.pbxXCBuildConfigurationSection();

  for (const key in configs) {
    const config = configs[key];
    const bs = config.buildSettings;
    if (!bs || !bs.PRODUCT_NAME) continue;

    const productName = bs.PRODUCT_NAME?.replace(/"/g, '');
    // Ignore other extensions/widgets
    if (
      productName &&
      (productName.includes('Extension') || productName.includes('Widget'))
    ) {
      continue;
    }

    const developmentTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '');
    if (developmentTeam) {
      l.log(
        `Found DEVELOPMENT_TEAM='${developmentTeam}' from main app configuration.`
      );
      return developmentTeam;
    }
  }

  l.error(
    'No DEVELOPMENT_TEAM found in main app build settings. Developer will need to manually add Dev Team.'
  );
  return null;
}

//───────────────────────────────────────────────────────────────────────────
// Main Expo config-plugin
//───────────────────────────────────────────────────────────────────────────
export const withBroadcastExtensionXcodeProject: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withXcodeProject(config, (newConfig) => {
    const xcodeProject = newConfig.modResults;
    const extensionTargetName = getBroadcastExtensionTargetName(props);

    const appIdentifier = newConfig.ios?.bundleIdentifier;
    assert(appIdentifier, "Missing 'ios.bundleIdentifier' in app config");

    const bundleIdentifier = getBroadcastExtensionBundleIdentifier(
      appIdentifier,
      props
    );

    /* ------------------------------------------------------------------ */
    /* 0. Resolve DEVELOPMENT_TEAM (props override > auto-detect > none)  */
    /* ------------------------------------------------------------------ */
    const detectedDevTeam = getMainAppDevelopmentTeam(
      xcodeProject,
      ScreenRecorderLog
    );
    const devTeam = detectedDevTeam ?? undefined;

    /* ------------------------------------------------------------------ */
    /* 1. Bail out early if target/group already exist                    */
    /* ------------------------------------------------------------------ */
    const existingTarget = xcodeProject.pbxTargetByName(extensionTargetName);
    if (existingTarget) {
      ScreenRecorderLog.log(
        `${extensionTargetName} already exists in project. Skipping…`
      );
      return newConfig;
    }

    const existingGroups = xcodeProject.hash.project.objects.PBXGroup;
    const groupExists = Object.values(existingGroups).some(
      (group: any) => group && group.name === extensionTargetName
    );
    if (groupExists) {
      ScreenRecorderLog.log(
        `${extensionTargetName} group already exists in project. Skipping…`
      );
      return newConfig;
    }

    /* ------------------------------------------------------------------ */
    /* 2. Create target, group & build phases (COMBINED APPROACH)        */
    /* ------------------------------------------------------------------ */
    const pbx = xcodeProject;
    // 2.1 Create PBXGroup for the extension (OneSignal style - single group creation)
    const extGroup = pbx.addPbxGroup(
      BROADCAST_EXT_ALL_FILES,
      extensionTargetName,
      extensionTargetName
    );

    // 2.2 Add the new PBXGroup to the top level group
    const groups = pbx.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach(function (key) {
      if (
        typeof groups[key] === 'object' &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        pbx.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // 2.3 WORK AROUND for addTarget BUG (from OneSignal)
    // Xcode projects don't contain these if there is only one target
    const projObjects = pbx.hash.project.objects;
    projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
    projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {};

    // 2.4 Create native target
    const target = pbx.addTarget(
      extensionTargetName,
      'app_extension',
      extensionTargetName
    );

    // 2.5 Add build phases to the new target (OneSignal approach)
    pbx.addBuildPhase(
      BROADCAST_EXT_SOURCE_FILES, // Add source files directly to the build phase
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid
    );
    pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    pbx.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    // 2.6 Link ReplayKit
    pbx.addFramework('ReplayKit.framework', {
      target: target.uuid,
      sourceTree: 'SDKROOT',
      link: true,
    });

    /* ------------------------------------------------------------------ */
    /* 3. Build-settings tweaks                                           */
    /* ------------------------------------------------------------------ */
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const cfg = configurations[key];
      const b = cfg.buildSettings;
      if (!b) continue;
      if (b.PRODUCT_NAME === `"${extensionTargetName}"`) {
        b.CLANG_ENABLE_MODULES = 'YES';
        b.INFOPLIST_FILE = `"${extensionTargetName}/BroadcastExtension-Info.plist"`;
        b.CODE_SIGN_ENTITLEMENTS = `"${extensionTargetName}/BroadcastExtension.entitlements"`;
        b.CODE_SIGN_STYLE = 'Automatic';
        b.CURRENT_PROJECT_VERSION =
          newConfig.ios?.buildNumber ?? DEFAULT_BUNDLE_VERSION;
        b.MARKETING_VERSION = newConfig.version ?? DEFAULT_BUNDLE_SHORT_VERSION;
        b.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleIdentifier}"`;
        b.SWIFT_VERSION = '5.0';
        b.SWIFT_EMIT_LOC_STRINGS = 'YES';
        b.SWIFT_OBJC_BRIDGING_HEADER = `"${extensionTargetName}/BroadcastExtension-Bridging-Header.h"`;
        b.HEADER_SEARCH_PATHS = `"$(SRCROOT)/${extensionTargetName}"`;
        b.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY;
        if (devTeam) b.DEVELOPMENT_TEAM = devTeam;
      }
    }

    /* ------------------------------------------------------------------ */
    /* 4. Apply DevelopmentTeam to both targets                           */
    /* ------------------------------------------------------------------ */
    if (devTeam) {
      xcodeProject.addTargetAttribute('DevelopmentTeam', devTeam);
      const broadcastTarget = xcodeProject.pbxTargetByName(extensionTargetName);
      xcodeProject.addTargetAttribute(
        'DevelopmentTeam',
        devTeam,
        broadcastTarget
      );
    }

    ScreenRecorderLog.log(
      `Successfully created ${extensionTargetName} target with files`
    );
    return newConfig;
  });
};
