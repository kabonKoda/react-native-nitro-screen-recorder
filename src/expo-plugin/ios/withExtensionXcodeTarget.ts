import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import path from 'node:path';
import {
  broadcastExtensionName,
  getBroadcastExtensionBundleIdentifier,
} from '../constants';
import {
  writeBroadcastExtensionFiles,
  getBroadcastExtensionInfoFilePath,
  getBroadcastExtensionEntitlementsFilePath,
  getMainExtensionPrivacyInfoFilePath,
  getBroadcastExtensionSampleHandlerPath,
  getBroadcastExtensionBroadcastWriterPath,
} from './writeBroadcastExtensionFiles';
import { ConfigProps } from '../@types';

/*───────────────────────────────────────────────────────────────────────────
 Helper to convert absolute paths into project‑relative paths for Xcode
───────────────────────────────────────────────────────────────────────────*/
function makeRelative(absPath: string, projectRoot: string) {
  return path.relative(projectRoot, absPath).replace(/\\/g, '/');
}

/*───────────────────────────────────────────────────────────────────────────
 ⚙️  Helper: ensure the phase UUID is listed in the target's buildPhases
───────────────────────────────────────────────────────────────────────────*/
function ensurePhaseOnTarget(
  pbx: any,
  targetUUID: string,
  phaseUUID: string,
  comment = 'Frameworks'
) {
  const nativeTargets = pbx.getPBXObject('PBXNativeTarget');
  const targetObj = nativeTargets[targetUUID];

  if (!targetObj) {
    console.warn(
      `[withBroadcastExtension] ⚠️  Could not find PBXNativeTarget ${targetUUID}`
    );
    return;
  }

  const already = (targetObj.buildPhases ?? []).some(
    (p: any) => (typeof p === 'object' ? p.value : p) === phaseUUID
  );

  if (!already) {
    targetObj.buildPhases.push({ value: phaseUUID, comment });
    console.log(
      `[withBroadcastExtension] • Attached Frameworks phase ${phaseUUID} to target buildPhases`
    );
  }
}

/*───────────────────────────────────────────────────────────────────────────
 ⚙️  Helper: Get the main app's DEVELOPMENT_TEAM from build settings
───────────────────────────────────────────────────────────────────────────*/
function getMainAppDevelopmentTeam(
  pbx: any,
  mainAppName: string
): string | null {
  const configs = pbx.pbxXCBuildConfigurationSection();

  for (const key in configs) {
    const config = configs[key];
    const bs = config.buildSettings;

    if (!bs || !bs.PRODUCT_NAME) continue;

    // Check if this is the main app's build configuration
    // The main app's PRODUCT_NAME is typically the scheme name or $(TARGET_NAME)
    const productName = bs.PRODUCT_NAME?.replace(/"/g, '');

    if (productName === mainAppName || productName === '$(TARGET_NAME)') {
      const developmentTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '');
      if (developmentTeam) {
        console.log(
          `[withBroadcastExtension] Found main app DEVELOPMENT_TEAM: ${developmentTeam}`
        );
        return developmentTeam;
      }
    }
  }

  // Fallback: look for any config with DEVELOPMENT_TEAM that's not an extension
  for (const key in configs) {
    const config = configs[key];
    const bs = config.buildSettings;

    if (!bs) continue;

    const productName = bs.PRODUCT_NAME?.replace(/"/g, '');
    const developmentTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '');

    // Skip if it looks like an extension
    if (
      productName &&
      (productName.includes('Extension') || productName.includes('Widget'))
    ) {
      continue;
    }

    if (developmentTeam) {
      console.log(
        `[withBroadcastExtension] Found DEVELOPMENT_TEAM from config: ${developmentTeam}`
      );
      return developmentTeam;
    }
  }

  console.warn(
    '[withBroadcastExtension] ⚠️  Could not find DEVELOPMENT_TEAM in main app'
  );
  return null;
}

export const withBroadcastExtensionXcodeTarget: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  console.log('[withBroadcastExtension] plugin invoked');

  return withXcodeProject(config, async (mod) => {
    console.log('[withBroadcastExtension] withXcodeProject callback');

    /*───────────────────────────────────────────────────────────────────
     Basic identifiers
    ───────────────────────────────────────────────────────────────────*/
    const extensionName = broadcastExtensionName;
    const projectRoot = mod.modRequest.platformProjectRoot;
    const scheme = mod.scheme! as string;
    const appIdentifier = mod.ios?.bundleIdentifier!;
    const bundleIdentifier =
      getBroadcastExtensionBundleIdentifier(appIdentifier);

    const currentProjectVersion = mod.ios!.buildNumber || '1';
    const marketingVersion = mod.version!;

    console.log('[withBroadcastExtension] identifiers:', {
      extensionName,
      projectRoot,
      scheme,
      appIdentifier,
      bundleIdentifier,
    });

    /*───────────────────────────────────────────────────────────────────
     Write extension Swift + plist + xcprivacy files
    ───────────────────────────────────────────────────────────────────*/
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

    /*───────────────────────────────────────────────────────────────────
     Get the main app's development team
    ───────────────────────────────────────────────────────────────────*/
    const mainAppDevelopmentTeam = getMainAppDevelopmentTeam(pbx, scheme);

    /*───────────────────────────────────────────────────────────────────
     MAIN EXTENSION TARGET  (BroadcastExtension)
    ───────────────────────────────────────────────────────────────────*/
    if (!pbx.pbxTargetByName(extensionName)) {
      console.log(`Adding target: ${extensionName}`);
      const target = pbx.addTarget(
        extensionName,
        'app_extension',
        extensionName
      );

      /* Groups & basic build phases */
      pbx.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      const groupKey = pbx.pbxCreateGroup(extensionName, extensionName);
      console.log(`  groupKey: ${groupKey}`);

      /* Info.plist + Entitlements + Privacy */
      const infoRel = makeRelative(
        getBroadcastExtensionInfoFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(infoRel, groupKey);

      const entRel = makeRelative(
        getBroadcastExtensionEntitlementsFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(entRel, groupKey);

      const privRel = makeRelative(
        getMainExtensionPrivacyInfoFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(privRel, groupKey);

      /* Swift sources */
      const handlerRel = makeRelative(
        getBroadcastExtensionSampleHandlerPath(projectRoot),
        projectRoot
      );
      pbx.addSourceFile(handlerRel, { target: target.uuid }, groupKey);
      const writerRel = makeRelative(
        getBroadcastExtensionBroadcastWriterPath(projectRoot),
        projectRoot
      );
      pbx.addSourceFile(writerRel, { target: target.uuid }, groupKey);

      /*──────── frameworks: ReplayKit ────────*/
      const rpFile = pbx.addFramework('ReplayKit.framework', {
        target: target.uuid,
        sourceTree: 'SDKROOT',
        link: true,
      });
      if (rpFile) console.log(`[BroadcastExtension] linked ReplayKit`);

      const fwSection = pbx.getPBXObject('PBXFrameworksBuildPhase');
      const phaseId = Object.entries(fwSection).find(([_, p]: any) =>
        (p.files ?? []).some(
          (f: any) => (typeof f === 'object' ? f.value : f) === rpFile.uuid
        )
      )?.[0];
      if (phaseId) ensurePhaseOnTarget(pbx, target.uuid, phaseId, 'Frameworks');
    }

    /*───────────────────────────────────────────────────────────────────
     Build‑settings tweaks for BroadcastExtension only.
    ───────────────────────────────────────────────────────────────────*/
    console.log('[withBroadcastExtension] configuring build settings');
    const configs = pbx.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      const bs = configs[key].buildSettings;
      if (!bs || !bs.PRODUCT_NAME) continue;

      if (bs.PRODUCT_NAME === `"${extensionName}"`) {
        console.log(`  Applying build settings for ${extensionName}`);
        bs.CLANG_ENABLE_MODULES = 'YES';
        bs.INFOPLIST_FILE = `"${makeRelative(
          getBroadcastExtensionInfoFilePath(projectRoot),
          projectRoot
        )}"`;
        bs.CODE_SIGN_ENTITLEMENTS = `"${makeRelative(
          getBroadcastExtensionEntitlementsFilePath(projectRoot),
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

        // Apply the main app's development team if found
        if (mainAppDevelopmentTeam) {
          bs.DEVELOPMENT_TEAM = `"${mainAppDevelopmentTeam}"`;
          console.log(
            `[withBroadcastExtension] Applied DEVELOPMENT_TEAM: ${mainAppDevelopmentTeam}`
          );
        } else {
          console.warn(
            '[withBroadcastExtension] ⚠️  No DEVELOPMENT_TEAM found to apply'
          );
        }
      }
    }

    return mod;
  });
};
