import plist from '@expo/plist';
import { ConfigPlugin } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAppGroup,
  broadcastExtensionName,
  broadcastExtensionSampleHandlerFileName,
  broadcastExtensionBroadcastWriterFileName,
} from '../constants';
import { ConfigProps } from '../@types';

export async function writeBroadcastExtensionFiles(
  platformProjectRoot: string,
  scheme: string,
  appIdentifier: string,
  props: ConfigProps,
  appName: ConfigPlugin<ConfigProps>['name']
) {
  // BroadcastExtension/Info.plist
  const mainInfoPlistFile =
    getBroadcastExtensionInfoFilePath(platformProjectRoot);

  const mainInfoPlistContet = getBroadcastExtensionInfoContent(
    appName,
    appIdentifier,
    props
  );
  await fs.promises.mkdir(path.dirname(mainInfoPlistFile), { recursive: true });
  await fs.promises.writeFile(mainInfoPlistFile, mainInfoPlistContet);

  // BroadcastExtension.entitlements
  const mainEntitlementsFilePath =
    getBroadcastExtensionEntitlementsFilePath(platformProjectRoot);

  const mainEntitlementsContent = getBroadcastExtensionEntitlementsContent(
    appIdentifier,
    props
  );
  await fs.promises.writeFile(
    mainEntitlementsFilePath,
    mainEntitlementsContent
  );

  // PrivacyInfo.xcprivacy
  const mainPrivacyFilePath =
    getMainExtensionPrivacyInfoFilePath(platformProjectRoot);

  const privacyContent = getPrivacyInfoContent();
  await fs.promises.writeFile(mainPrivacyFilePath, privacyContent);

  // SampleHandler.swift
  const sampleHandlerFilePath =
    getBroadcastExtensionSampleHandlerPath(platformProjectRoot);
  const sampleHandlerContent = getBroadcastExtensionSampleHandlerContent(
    scheme,
    getAppGroup(appIdentifier, props)
  );

  await fs.promises.writeFile(sampleHandlerFilePath, sampleHandlerContent);

  // BroadcastWriter.swift
  const broadcastWriterFilePath =
    getBroadcastExtensionBroadcastWriterPath(platformProjectRoot);
  const broadcastWriterContent = getBroadcastExtensionBroadcastWriterContent();

  await fs.promises.writeFile(broadcastWriterFilePath, broadcastWriterContent);
}

//: [root]/ios/BroadcastExtension/BroadcastExtension.entitlements
export function getBroadcastExtensionEntitlementsFilePath(
  platformProjectRoot: string
) {
  return path.join(
    platformProjectRoot,
    broadcastExtensionName,
    `${broadcastExtensionName}.entitlements`
  );
}

export function getBroadcastExtensionEntitlements(
  appIdentifier: string,
  props: ConfigProps
) {
  return {
    'com.apple.security.application-groups': [
      getAppGroup(appIdentifier, props),
    ],
  };
}

export function getBroadcastExtensionEntitlementsContent(
  appIdentifier: string,
  props: ConfigProps
) {
  return plist.build(getBroadcastExtensionEntitlements(appIdentifier, props));
}

export function getBroadcastExtensionSetupUIEntitlements(
  appIdentifier: string,
  props: ConfigProps
) {
  return {
    'com.apple.security.application-groups': [
      getAppGroup(appIdentifier, props),
    ],
  };
}

export function getBroadcastExtensionSetupUIEntitlementsContent(
  appIdentifier: string,
  props: ConfigProps
) {
  return plist.build(
    getBroadcastExtensionSetupUIEntitlements(appIdentifier, props)
  );
}

//: [root]/ios/BroadcastExtension/Info.plist
export function getBroadcastExtensionInfoFilePath(platformProjectRoot: string) {
  return path.join(platformProjectRoot, broadcastExtensionName, 'Info.plist');
}
export function getBroadcastExtensionInfoContent(
  appName: ConfigPlugin<ConfigProps>['name'],
  appIdentifier: string,
  props: ConfigProps
) {
  return plist.build({
    CFBundleName: '$(PRODUCT_NAME)',
    CFBundleDisplayName: `${appName} - Broadcast Extension`,
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
    CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundleInfoDictionaryVersion: '6.0',
    CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)',
    NSExtension: {
      // The system looks for this identifier to know it’s a broadcast‐upload extension
      NSExtensionPointIdentifier: 'com.apple.broadcast-services-upload',
      // Your SampleHandler class for processing video/audio buffers
      NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SampleHandler',

      // We’re using the sample‐buffer API for local recording
      RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer',
    },
    // your shared‐container group
    AppGroupIdentifier: getAppGroup(appIdentifier, props),
  });
}

//: [root]/ios/BroadcastExtension/PrivacyInfo.xcprivacy
export function getMainExtensionPrivacyInfoFilePath(
  platformProjectRoot: string
) {
  return path.join(
    platformProjectRoot,
    broadcastExtensionName,
    'PrivacyInfo.xcprivacy'
  );
}

export function getPrivacyInfoContent() {
  return plist.build({
    NSPrivacy: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryScreenCapture',
          NSPrivacyAccessedAPITypeReason:
            'User‑initiated screen recording via ReplayKit',
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryAudio',
          NSPrivacyAccessedAPITypeReason:
            'User‑initiated microphone capture in screen recording',
        },
      ],
      NSPrivacyCollectedDataTypes: [],
    },
  });
}

//: [root]/ios/BroadcastExension/SampleHandler.swift
export function getBroadcastExtensionSampleHandlerPath(
  platformProjectRoot: string
) {
  return path.join(
    platformProjectRoot,
    broadcastExtensionName,
    broadcastExtensionSampleHandlerFileName
  );
}

export function getBroadcastExtensionSampleHandlerContent(
  scheme: string,
  groupIdentifier: string
) {
  let updatedScheme = scheme;
  if (Array.isArray(scheme)) {
    console.warn(
      `[react-native-nitro-screen-recorder] multiple scheme detected (${scheme.join(',')}), using:${updatedScheme}`
    );
    updatedScheme = scheme[0];
  }
  console.warn(
    `[react-native-nitro-screen-recorder] add ios broadcast extension (scheme:${updatedScheme} groupIdentifier:${groupIdentifier})`
  );
  if (!updatedScheme) {
    throw new Error(
      "[react-native-nitro-screen-recorder] missing custom URL scheme 'expo.scheme' in app.json ! (see https://docs.expo.dev/guides/linking/#linking-to-your-app)"
    );
  }

  const content = fs.readFileSync(
    path.resolve(__dirname, './SampleHandler.swift'),
    'utf8'
  );

  return content
    .replaceAll('<SCHEME>', updatedScheme)
    .replaceAll('<GROUPIDENTIFIER>', groupIdentifier);
}

export function getBroadcastExtensionBroadcastWriterPath(
  platformProjectRoot: string
) {
  return path.join(
    platformProjectRoot,
    broadcastExtensionName,
    broadcastExtensionBroadcastWriterFileName
  );
}

export function getBroadcastExtensionBroadcastWriterContent() {
  const content = fs.readFileSync(
    path.resolve(__dirname, './BroadcastWriter.swift'),
    'utf8'
  );
  return content;
}
