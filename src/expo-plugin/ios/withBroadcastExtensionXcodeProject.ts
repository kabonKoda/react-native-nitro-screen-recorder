import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import {
  BROADCAST_EXT_TARGET_NAME,
  BROADCAST_EXT_SOURCE_FILES,
  BROADCAST_EXT_CONFIG_FILES,
  TARGETED_DEVICE_FAMILY,
  DEFAULT_BUNDLE_VERSION,
  DEFAULT_BUNDLE_SHORT_VERSION,
  getBroadcastExtensionBundleIdentifier,
} from '../support/iosConstants';
import { ConfigProps } from '../@types';
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

  l.log('No DEVELOPMENT_TEAM found in main app build settings.');
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
    const existingTarget = xcodeProject.pbxTargetByName(
      BROADCAST_EXT_TARGET_NAME
    );
    if (existingTarget) {
      ScreenRecorderLog.log(
        `${BROADCAST_EXT_TARGET_NAME} already exists in project. Skipping…`
      );
      return newConfig;
    }

    const existingGroups = xcodeProject.hash.project.objects.PBXGroup;
    const groupExists = Object.values(existingGroups).some(
      (group: any) => group && group.name === BROADCAST_EXT_TARGET_NAME
    );
    if (groupExists) {
      ScreenRecorderLog.log(
        `${BROADCAST_EXT_TARGET_NAME} group already exists in project. Skipping…`
      );
      return newConfig;
    }

    /* ------------------------------------------------------------------ */
    /* 2. Create target, group & build phases (COMBINED APPROACH)        */
    /* ------------------------------------------------------------------ */
    const pbx = xcodeProject;

    // 2.1 Create PBXGroup for the extension (OneSignal style - single group creation)
    const extGroup = pbx.addPbxGroup(
      [...BROADCAST_EXT_SOURCE_FILES, ...BROADCAST_EXT_CONFIG_FILES],
      BROADCAST_EXT_TARGET_NAME,
      BROADCAST_EXT_TARGET_NAME
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
      BROADCAST_EXT_TARGET_NAME,
      'app_extension',
      BROADCAST_EXT_TARGET_NAME
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
      if (b.PRODUCT_NAME === `"${BROADCAST_EXT_TARGET_NAME}"`) {
        b.CLANG_ENABLE_MODULES = 'YES';
        b.INFOPLIST_FILE = `"${BROADCAST_EXT_TARGET_NAME}/${BROADCAST_EXT_TARGET_NAME}-Info.plist"`;
        b.CODE_SIGN_ENTITLEMENTS = `"${BROADCAST_EXT_TARGET_NAME}/${BROADCAST_EXT_TARGET_NAME}.entitlements"`;
        b.CODE_SIGN_STYLE = 'Automatic';
        b.CURRENT_PROJECT_VERSION =
          newConfig.ios?.buildNumber ?? DEFAULT_BUNDLE_VERSION;
        b.MARKETING_VERSION = newConfig.version ?? DEFAULT_BUNDLE_SHORT_VERSION;
        b.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleIdentifier}"`;
        b.SWIFT_VERSION = '5.0';
        b.SWIFT_EMIT_LOC_STRINGS = 'YES';
        b.SWIFT_OBJC_BRIDGING_HEADER = `"${BROADCAST_EXT_TARGET_NAME}/BroadcastExtension-Bridging-Header.h"`;
        b.HEADER_SEARCH_PATHS = `"$(SRCROOT)/${BROADCAST_EXT_TARGET_NAME}"`;
        b.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY;
        if (devTeam) b.DEVELOPMENT_TEAM = devTeam;
      }
    }

    /* ------------------------------------------------------------------ */
    /* 4. Apply DevelopmentTeam to both targets                           */
    /* ------------------------------------------------------------------ */
    if (devTeam) {
      xcodeProject.addTargetAttribute('DevelopmentTeam', devTeam);
      const broadcastTarget = xcodeProject.pbxTargetByName(
        BROADCAST_EXT_TARGET_NAME
      );
      xcodeProject.addTargetAttribute(
        'DevelopmentTeam',
        devTeam,
        broadcastTarget
      );
    }

    ScreenRecorderLog.log(
      `Successfully created ${BROADCAST_EXT_TARGET_NAME} target with files`
    );
    return newConfig;
  });
};
