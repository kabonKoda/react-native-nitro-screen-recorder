import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import path from 'node:path';
import {
  getBroadcastExtensionName,
  getBroadcastExtensionBundleIdentifier,
} from '../constants';
import {
  writeBroadcastExtensionFiles,
  getBroadcastExtensionInfoFilePath,
  getBroadcastExtensionEntitlementsFilePath,
  getMainExtensionPrivacyInfoFilePath,
  getBroadcastExtensionSampleHandlerPath,
  getBroadcastPickerViewControllerPath,
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
    const extensionName = getBroadcastExtensionName(props);
    const projectRoot = mod.modRequest.platformProjectRoot;
    const scheme = mod.scheme! as string;
    const appIdentifier = mod.ios?.bundleIdentifier!;
    const bundleIdentifier = getBroadcastExtensionBundleIdentifier(
      appIdentifier,
      props
    );
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
     MAIN EXTENSION TARGET
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

      /* Info.plist */
      const infoRel = makeRelative(
        getBroadcastExtensionInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Info.plist: ${infoRel}`);
      pbx.addFile(infoRel, groupKey);

      /* Entitlements */
      const entRel = makeRelative(
        getBroadcastExtensionEntitlementsFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Entitlements: ${entRel}`);
      pbx.addFile(entRel, groupKey);

      /* Privacy (.xcprivacy) */
      const privRel = makeRelative(
        getMainExtensionPrivacyInfoFilePath(projectRoot, props),
        projectRoot
      );
      console.log(`  Privacy: ${privRel}`);
      try {
        pbx.addFile(privRel, groupKey);
        console.log('  -> added PrivacyInfo.xcprivacy');
      } catch (e) {
        console.error('Error adding PrivacyInfo.xcprivacy:', e);
        throw e;
      }

      /* Swift sources */
      const handlerRel = makeRelative(
        getBroadcastExtensionSampleHandlerPath(projectRoot, props),
        projectRoot
      );
      pbx.addSourceFile(handlerRel, { target: target.uuid }, groupKey);

      const pickerRel = makeRelative(
        getBroadcastPickerViewControllerPath(projectRoot, props),
        projectRoot
      );
      pbx.addSourceFile(pickerRel, { target: target.uuid }, groupKey);

      /*───────────────────────────
        THIS SECTION – frameworks
      ───────────────────────────*/
      const replayKitFile = pbx.addFramework('ReplayKit.framework', {
        target: target.uuid,
        sourceTree: 'SDKROOT',
        link: true,
      });

      if (replayKitFile) {
        console.log(
          `[withBroadcastExtension] • ReplayKit.framework linked – fileRef: ${replayKitFile.fileRef}`
        );
      } else {
        console.log(
          '[withBroadcastExtension] • ReplayKit.framework was already linked – skipping'
        );
      }

      /* Attach / locate the frameworks phase */
      const fwSection = pbx.getPBXObject('PBXFrameworksBuildPhase');
      const buildFileUUID = replayKitFile.uuid;
      let phaseIdWithReplayKit: string | undefined;

      for (const [uuid, phase] of Object.entries(fwSection)) {
        const files: any[] | undefined = (phase as any).files;
        if (
          Array.isArray(files) &&
          files.some(
            (f) => (typeof f === 'object' ? f.value : f) === buildFileUUID
          )
        ) {
          phaseIdWithReplayKit = uuid;
          /* 🔧 NEW: make sure the phase is on the target */
          ensurePhaseOnTarget(
            pbx,
            target.uuid,
            phaseIdWithReplayKit,
            'Frameworks'
          );

          console.log(
            `[withBroadcastExtension] • ReplayKit.framework now lives in PBXFrameworksBuildPhase ${uuid}`
          );
          console.log(
            `[withBroadcastExtension]   phase files:`,
            files.map((f) => (typeof f === 'object' ? f.comment : f)).join(', ')
          );
          break;
        }
      }

      if (!phaseIdWithReplayKit) {
        console.warn(
          '[withBroadcastExtension] ⚠️  Could not locate a PBXFrameworksBuildPhase containing ReplayKit.framework – please inspect project.pbxproj manually.'
        );
      }
      /*────────────── END THIS SECTION ──────────────*/
    } else {
      console.log(`Target ${extensionName} already exists`);
    }

    /*───────────────────────────────────────────────────────────────────
     Build settings tweaks
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
    }

    /*───────────────────────────────────────────────────────────────────
     Debug dump for quick inspection
    ───────────────────────────────────────────────────────────────────*/
    console.log(
      '[withBroadcastExtension] DEBUG – FrameworksBuildPhase section:',
      JSON.stringify(pbx.getPBXObject('PBXFrameworksBuildPhase'), null, 2)
    );

    return mod;
  });
};
