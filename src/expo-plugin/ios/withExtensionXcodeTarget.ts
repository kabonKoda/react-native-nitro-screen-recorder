import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import path from 'node:path';
import {
  broadcastExtensionName,
  // broadcastExtensionSetupUIName,
  getBroadcastExtensionBundleIdentifier,
  // getBroadcastExtensionSetupUIBundleIdentifier,
} from '../constants';
import {
  writeBroadcastExtensionFiles,
  getBroadcastExtensionInfoFilePath,
  getBroadcastExtensionEntitlementsFilePath,
  // getBroadcastExtensionSetupUIInfoFilePath,
  // getBroadcastExtensionSetupUIEntitlementsFilePath,
  getMainExtensionPrivacyInfoFilePath,
  // getSetupUIPrivacyInfoFilePath,
  getBroadcastExtensionSampleHandlerPath,
  // getBroadcastExtensionSetupUIViewControllerPath,
} from './writeBroadcastExtensionFiles';
import { ConfigProps } from '../@types';

/*───────────────────────────────────────────────────────────────────────────
 Helper to convert absolute paths into project‑relative paths for Xcode
───────────────────────────────────────────────────────────────────────────*/
function makeRelative(absPath: string, projectRoot: string) {
  return path.relative(projectRoot, absPath).replace(/\\/g, '/');
}

/*───────────────────────────────────────────────────────────────────────────
 ⚙️  Helper: ensure the phase UUID is listed in the target’s buildPhases
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
    // const setupUIName = broadcastExtensionSetupUIName;
    const projectRoot = mod.modRequest.platformProjectRoot;
    const scheme = mod.scheme! as string;
    const appIdentifier = mod.ios?.bundleIdentifier!;
    const bundleIdentifier =
      getBroadcastExtensionBundleIdentifier(appIdentifier);
    // const setupUIBundleIdentifier =
    // getBroadcastExtensionSetupUIBundleIdentifier(appIdentifier);

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
     SETUP UI EXTENSION TARGET  (BroadcastExtensionSetupUI)
    ───────────────────────────────────────────────────────────────────*/
    // if (!pbx.pbxTargetByName(setupUIName)) {
    //   console.log(`Adding target: ${setupUIName}`);
    //   const target = pbx.addTarget(setupUIName, 'app_extension', setupUIName);

    //   /* Groups & basic build phases */
    //   pbx.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    //   pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    //   const groupKey = pbx.pbxCreateGroup(setupUIName, setupUIName); // ← fixed
    //   console.log(`  groupKey: ${groupKey}`);

    //   /* Info.plist + Entitlements + Privacy */
    //   pbx.addFile(
    //     makeRelative(
    //       getBroadcastExtensionSetupUIInfoFilePath(projectRoot),
    //       projectRoot
    //     ),
    //     groupKey
    //   );
    //   pbx.addFile(
    //     makeRelative(
    //       getBroadcastExtensionSetupUIEntitlementsFilePath(projectRoot),
    //       projectRoot
    //     ),
    //     groupKey
    //   );
    //   pbx.addFile(
    //     makeRelative(getSetupUIPrivacyInfoFilePath(projectRoot), projectRoot),
    //     groupKey
    //   );

    //   /* Swift + UI sources */
    //   pbx.addSourceFile(
    //     makeRelative(
    //       getBroadcastExtensionSetupUIViewControllerPath(projectRoot),
    //       projectRoot
    //     ),
    //     { target: target.uuid },
    //     groupKey
    //   );
    //   pbx.addSourceFile(
    //     makeRelative(
    //       getBroadcastExtensionSetupUIViewControllerPath(projectRoot),
    //       projectRoot
    //     ),
    //     { target: target.uuid },
    //     groupKey
    //   );

    //   // /* (Optional) Storyboard resource */
    //   // const storyboardRel = makeRelative(
    //   //   getBroadcastExtensionStoryboardFilePath(projectRoot, props),
    //   //   projectRoot
    //   // );
    //   // pbx.addFile(storyboardRel, groupKey);
    //   // pbx.addResourceFile(storyboardRel, { target: target.uuid }, groupKey);

    //   /*──────── frameworks: ReplayKit & UIKit ────────*/
    //   const frameworks = ['ReplayKit.framework', 'UIKit.framework'];
    //   const added = frameworks
    //     .map((fw) =>
    //       pbx.addFramework(fw, {
    //         target: target.uuid,
    //         sourceTree: 'SDKROOT',
    //         link: true,
    //       })
    //     )
    //     .filter(Boolean);

    //   added.forEach((f: any) => console.log(`[SetupUI] linked ${f.basename}`));

    //   /* attach phase */
    //   if (added.length) {
    //     const fwSection = pbx.getPBXObject('PBXFrameworksBuildPhase');
    //     const bfUuid = added[0].uuid;
    //     const phaseId = Object.entries(fwSection).find(([_, p]: any) =>
    //       (p.files ?? []).some(
    //         (file: any) =>
    //           (typeof file === 'object' ? file.value : file) === bfUuid
    //       )
    //     )?.[0];
    //     if (phaseId)
    //       ensurePhaseOnTarget(pbx, target.uuid, phaseId, 'Frameworks');
    //   }
    // }

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
      }

      // if (bs.PRODUCT_NAME === `"${setupUIName}"`) {
      //   console.log(`  Applying build settings for ${setupUIName}`);
      //   bs.CLANG_ENABLE_MODULES = 'YES';
      //   bs.INFOPLIST_FILE = `"${makeRelative(
      //     getBroadcastExtensionSetupUIInfoFilePath(projectRoot),
      //     projectRoot
      //   )}"`;
      //   bs.CODE_SIGN_ENTITLEMENTS = `"${makeRelative(
      //     getBroadcastExtensionSetupUIEntitlementsFilePath(projectRoot),
      //     projectRoot
      //   )}"`;
      //   bs.CODE_SIGN_STYLE = 'Automatic';
      //   bs.CURRENT_PROJECT_VERSION = `"${currentProjectVersion}"`;
      //   bs.GENERATE_INFOPLIST_FILE = 'YES';
      //   bs.MARKETING_VERSION = `"${marketingVersion}"`;
      //   bs.PRODUCT_BUNDLE_IDENTIFIER = `"${setupUIBundleIdentifier}"`;
      //   bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
      //   bs.SWIFT_VERSION = '5.0';
      //   bs.TARGETED_DEVICE_FAMILY = '"1,2"';
      // }
    }

    return mod;
  });
};
