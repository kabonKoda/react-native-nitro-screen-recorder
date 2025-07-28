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
import { makePluginLogger, PluginLogger } from './PluginLogger';

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
  comment = 'Frameworks',
  l: PluginLogger
) {
  const nativeTargets = pbx.getPBXObject('PBXNativeTarget');
  const targetObj = nativeTargets?.[targetUUID];

  if (!targetObj) {
    l.warn(
      `Unable to attach build phase '${comment}' (${phaseUUID}): PBXNativeTarget not found (UUID=${targetUUID}). ` +
        `Tip: Verify the target exists in your .xcodeproj.`
    );
    return;
  }

  const already = (targetObj.buildPhases ?? []).some(
    (p: any) => (typeof p === 'object' ? p.value : p) === phaseUUID
  );

  if (!already) {
    targetObj.buildPhases.push({ value: phaseUUID, comment });
    l.info(
      `Attached build phase '${comment}' (UUID=${phaseUUID}) to target (UUID=${targetUUID}).`
    );
  } else {
    l.info(
      `Build phase '${comment}' (UUID=${phaseUUID}) is already attached to target (UUID=${targetUUID}).`
    );
  }
}

/*───────────────────────────────────────────────────────────────────────────
 ⚙️  Helper: Get the main app's DEVELOPMENT_TEAM from build settings
───────────────────────────────────────────────────────────────────────────*/
function getMainAppDevelopmentTeam(
  pbx: any,
  mainAppName: string,
  l: PluginLogger
): string | null {
  const configs = pbx.pbxXCBuildConfigurationSection();

  for (const key in configs) {
    const config = configs[key];
    const bs = config.buildSettings;
    if (!bs || !bs.PRODUCT_NAME) continue;

    const productName = bs.PRODUCT_NAME?.replace(/"/g, '');
    if (productName === mainAppName || productName === '$(TARGET_NAME)') {
      const developmentTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '');
      if (developmentTeam) {
        l.info(
          `Resolved DEVELOPMENT_TEAM='${developmentTeam}' from main app configuration (PRODUCT_NAME='${productName}').`
        );
        return developmentTeam;
      }
    }
  }

  // Fallback: any non-extension config with a team
  for (const key in configs) {
    const config = configs[key];
    const bs = config.buildSettings;
    if (!bs) continue;

    const productName = bs.PRODUCT_NAME?.replace(/"/g, '');
    const developmentTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '');

    if (
      productName &&
      (productName.includes('Extension') || productName.includes('Widget'))
    ) {
      continue;
    }
    if (developmentTeam) {
      l.info(
        `Resolved DEVELOPMENT_TEAM='${developmentTeam}' from fallback configuration (PRODUCT_NAME='${productName ?? 'N/A'}').`
      );
      return developmentTeam;
    }
  }

  l.warn(
    `No DEVELOPMENT_TEAM detected in main app build settings. ` +
      `Action required: Open Xcode → Targets → YourApp → Signing & Capabilities and ensure a Team is selected.`
  );
  return null;
}

export const withBroadcastExtensionXcodeTarget: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  const l = makePluginLogger(props.showPluginLogs ?? false);

  return withXcodeProject(config, async (mod) => {
    const startedAt = Date.now();

    /*───────────────────────────────────────────────────────────────────
     STEP 0/4: Context summary
    ───────────────────────────────────────────────────────────────────*/
    const extensionName = broadcastExtensionName;
    const projectRoot = mod.modRequest.platformProjectRoot;
    const scheme = mod.scheme! as string;
    const appIdentifier = mod.ios?.bundleIdentifier!;
    const bundleIdentifier =
      getBroadcastExtensionBundleIdentifier(appIdentifier);
    const currentProjectVersion = mod.ios!.buildNumber || '1';
    const marketingVersion = mod.version!;
    const summary = [
      `Preparing Broadcast Upload Extension target...`,
      `  • Scheme:               ${scheme}`,
      `  • App bundle ID:        ${appIdentifier}`,
      `  • Extension target:     ${extensionName}`,
      `  • Extension bundle ID:  ${bundleIdentifier}`,
      `  • Marketing version:    ${marketingVersion}`,
      `  • Project version:      ${currentProjectVersion}`,
      `  • Project root:         ${projectRoot}`,
    ].join('\n');
    l.info(summary);

    /*───────────────────────────────────────────────────────────────────
     STEP 1/4: Emit Swift, plist, entitlements, privacy files
    ───────────────────────────────────────────────────────────────────*/
    l.step('STEP 1/4 — Generating extension source and configuration files');
    await writeBroadcastExtensionFiles(
      projectRoot,
      scheme,
      appIdentifier,
      props,
      mod.name
    );
    l.info(
      `Wrote extension files: SampleHandler.swift, BroadcastWriter.swift, Info.plist, Entitlements, and Privacy manifest.`
    );

    /*───────────────────────────────────────────────────────────────────
     STEP 2/4: Load PBX project
    ───────────────────────────────────────────────────────────────────*/
    l.step('STEP 2/4 — Loading Xcode project (PBX) for modifications');
    const pbx = mod.modResults;

    /*───────────────────────────────────────────────────────────────────
     STEP 3/4: Ensure target + files + frameworks
    ───────────────────────────────────────────────────────────────────*/
    l.step(
      'STEP 3/4 — Creating or updating the Broadcast extension target and sources'
    );

    const existingTarget = pbx.pbxTargetByName(extensionName);
    if (!existingTarget) {
      l.info(
        `Extension target '${extensionName}' not found — creating PBXNativeTarget and required build phases.`
      );
      const target = pbx.addTarget(
        extensionName,
        'app_extension',
        extensionName
      );

      // Groups & basic build phases
      pbx.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      const groupKey = pbx.pbxCreateGroup(extensionName, extensionName);
      l.info(
        `Created PBX group '${extensionName}' (UUID=${groupKey}) to contain extension sources and configuration files.`
      );

      // Info.plist + Entitlements + Privacy
      const infoRel = makeRelative(
        getBroadcastExtensionInfoFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(infoRel, groupKey);
      l.info(`Registered Info.plist at '${infoRel}' in extension group.`);

      const entRel = makeRelative(
        getBroadcastExtensionEntitlementsFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(entRel, groupKey);
      l.info(`Registered Entitlements at '${entRel}' in extension group.`);

      const privRel = makeRelative(
        getMainExtensionPrivacyInfoFilePath(projectRoot),
        projectRoot
      );
      pbx.addFile(privRel, groupKey);
      l.info(`Registered Privacy manifest at '${privRel}' in extension group.`);

      // Swift sources
      const handlerRel = makeRelative(
        getBroadcastExtensionSampleHandlerPath(projectRoot),
        projectRoot
      );
      pbx.addSourceFile(handlerRel, { target: target.uuid }, groupKey);
      l.info(`Added Swift source: SampleHandler.swift → '${handlerRel}'.`);

      const writerRel = makeRelative(
        getBroadcastExtensionBroadcastWriterPath(projectRoot),
        projectRoot
      );
      pbx.addSourceFile(writerRel, { target: target.uuid }, groupKey);
      l.info(`Added Swift source: BroadcastWriter.swift → '${writerRel}'.`);

      // Frameworks: ReplayKit
      const rpFile = pbx.addFramework('ReplayKit.framework', {
        target: target.uuid,
        sourceTree: 'SDKROOT',
        link: true,
      });
      if (rpFile) {
        l.info(
          `Linked system framework 'ReplayKit.framework' (fileRef UUID=${rpFile.uuid}).`
        );
      } else {
        l.warn(
          `ReplayKit.framework did not return a fileRef; the link may already exist. Verify in Xcode → Build Phases → Link Binary With Libraries.`
        );
      }

      const fwSection = pbx.getPBXObject('PBXFrameworksBuildPhase');
      const phaseId = Object.entries(fwSection).find(([_, p]: any) =>
        (p.files ?? []).some(
          (f: any) => (typeof f === 'object' ? f.value : f) === rpFile?.uuid
        )
      )?.[0];

      if (phaseId) {
        ensurePhaseOnTarget(pbx, target.uuid, phaseId, 'Frameworks', l);
      } else {
        l.warn(
          `Could not resolve the Frameworks build phase that contains ReplayKit; the PBX relationship may be implicit.`
        );
      }
    } else {
      l.info(
        `Detected existing extension target '${extensionName}' — skipping target creation and proceeding to build settings.`
      );
    }

    /*───────────────────────────────────────────────────────────────────
     STEP 4/4: Configure build settings (code sign, plist paths, versions)
    ───────────────────────────────────────────────────────────────────*/
    l.step(
      'STEP 4/4 — Applying extension build settings (signing, versions, plist, Swift)'
    );
    const mainAppDevelopmentTeam = getMainAppDevelopmentTeam(pbx, scheme, l);

    const configs = pbx.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      const bs = configs[key].buildSettings;
      if (!bs || !bs.PRODUCT_NAME) continue;

      if (bs.PRODUCT_NAME === `"${extensionName}"`) {
        l.info(
          `Updating build settings for extension '${extensionName}' (CONFIG=${configs[key].name ?? key}).`
        );

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

        if (mainAppDevelopmentTeam) {
          bs.DEVELOPMENT_TEAM = `"${mainAppDevelopmentTeam}"`;
          l.info(
            `Applied DEVELOPMENT_TEAM='${mainAppDevelopmentTeam}' to extension build settings.`
          );
        } else {
          l.warn(
            `DEVELOPMENT_TEAM was not applied to the extension. ` +
              `Action: Set a Team on the main app target and re-run prebuild, or manually set DEVELOPMENT_TEAM for the extension in Xcode.`
          );
        }
      }
    }

    // Final summary
    const elapsedMs = Date.now() - startedAt;
    l.info(
      [
        `Broadcast extension configuration complete ✅`,
        `  • Target:              ${extensionName}`,
        `  • Bundle ID:           ${bundleIdentifier}`,
        `  • Versions:            ${marketingVersion} (${currentProjectVersion})`,
        `  • Duration:            ${elapsedMs}ms`,
        `Open Xcode → select the extension target → verify Signing & Capabilities and 'Link Binary With Libraries' include ReplayKit.`,
      ].join('\n')
    );

    return mod;
  });
};
