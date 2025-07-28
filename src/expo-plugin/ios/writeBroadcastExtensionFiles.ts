import plist from '@expo/plist';
import { ConfigPlugin } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAppGroup,
  broadcastExtensionName,
  broadcastExtensionSampleHandlerFileName,
  // broadcastExtensionSetupUIViewControllerFileName,
  // broadcastExtensionSetupUIName,
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

  // BroadcastExtensionSetupUI/Info.plist
  // const setupUIInfoPlistFilePath =
  //   getBroadcastExtensionSetupUIInfoFilePath(platformProjectRoot);

  // const setupUIInfoPlistContent = getBroadcastExtensionSetupUIInfoContent(
  //   appName,
  //   appIdentifier,
  //   props
  // );
  // await fs.promises.mkdir(path.dirname(setupUIInfoPlistFilePath), {
  //   recursive: true,
  // });
  // await fs.promises.writeFile(
  //   setupUIInfoPlistFilePath,
  //   setupUIInfoPlistContent
  // );

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

  // BroadcastExtensionSetupUI.entitlements
  // const setupUIEntitlementsFilePath =
  //   getBroadcastExtensionSetupUIEntitlementsFilePath(platformProjectRoot);
  // const setupUIEntitlementsContent =
  //   getBroadcastExtensionSetupUIEntitlementsContent(appIdentifier, props);
  // await fs.promises.writeFile(
  //   setupUIEntitlementsFilePath,
  //   setupUIEntitlementsContent
  // );

  // PrivacyInfo.xcprivacy
  const mainPrivacyFilePath =
    getMainExtensionPrivacyInfoFilePath(platformProjectRoot);

  // const setupUIPrivacyFilePath =
  //   getSetupUIPrivacyInfoFilePath(platformProjectRoot);

  const privacyContent = getPrivacyInfoContent();
  await fs.promises.writeFile(mainPrivacyFilePath, privacyContent);
  // await fs.promises.writeFile(setupUIPrivacyFilePath, privacyContent);

  // MainInterface.storyboard;
  // const storyboardFilePath = getBroadcastExtensionStoryboardFilePath(
  //   platformProjectRoot,
  //   props
  // );
  // const storyboardContent = getBroadcastExtensionStoryBoardContent();
  // await fs.promises.writeFile(storyboardFilePath, storyboardContent);

  // SampleHandler.swift
  const sampleHandlerFilePath =
    getBroadcastExtensionSampleHandlerPath(platformProjectRoot);
  const sampleHandlerContent = getBroadcastExtensionSampleHandlerContent(
    scheme,
    getAppGroup(appIdentifier, props)
  );

  await fs.promises.writeFile(sampleHandlerFilePath, sampleHandlerContent);

  // BroadcastUISetupViewController.swift
  // const viewControllerFilePath =
  //   getBroadcastExtensionSetupUIViewControllerPath(platformProjectRoot);
  // const viewControllerContent =
  //   getBroadcastExtensionSetupUIViewControllerContent(
  //     scheme,
  //     getAppGroup(appIdentifier, props)
  //   );

  // await fs.promises.writeFile(viewControllerFilePath, viewControllerContent);
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

//: [root]/ios/BroadcastExtensionSetupUI/BroadcastExtensionSetupUI.entitlements
// export function getBroadcastExtensionSetupUIEntitlementsFilePath(
//   platformProjectRoot: string
// ) {
//   return path.join(
//     platformProjectRoot,
//     broadcastExtensionSetupUIName,
//     `${broadcastExtensionSetupUIName}.entitlements`
//   );
// }

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

// export function getBroadcastExtensionSetupUIInfoFilePath(
//   platformProjectRoot: string
// ) {
//   return path.join(
//     platformProjectRoot,
//     broadcastExtensionSetupUIName,
//     'Info.plist'
//   );
// }

// export function getBroadcastExtensionSetupUIInfoContent(
//   appName: ConfigPlugin<ConfigProps>['name'],
//   appIdentifier: string,
//   props: ConfigProps
// ) {
//   return plist.build({
//     CFBundleName: '$(PRODUCT_NAME)',
//     CFBundleDisplayName: `${appName} - Broadcast Extension Setup UI`,
//     CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
//     CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
//     CFBundleExecutable: '$(EXECUTABLE_NAME)',
//     CFBundleInfoDictionaryVersion: '6.0',
//     CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)',
//     NSExtension: {
//       NSExtensionAttributes: {
//         NSExtensionActivationRule: {
//           NSExtensionActivationSupportsReplayKitStreaming: true,
//         },
//       },
//       NSExtensionPointIdentifier: 'com.apple.broadcast-services-setupui',
//       NSExtensionPrincipalClass:
//         '$(PRODUCT_MODULE_NAME).BroadcastSetupViewController',
//     },
//     AppGroupIdentifier: getAppGroup(appIdentifier, props),
//   });
// }

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

// : [root]/ios/BroadcastExtensionSetupUI/PrivacyInfo.xcprivacy
// export function getSetupUIPrivacyInfoFilePath(platformProjectRoot: string) {
//   return path.join(
//     platformProjectRoot,
//     broadcastExtensionSetupUIName,
//     'PrivacyInfo.xcprivacy'
//   );
// }

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

//: [root]/ios/BroadcastExtensionSetupUI/MainInterface.storyboard
// export function getBroadcastExtensionStoryboardFilePath(
//   platformProjectRoot: string,
//   props: ConfigProps
// ) {
//   return path.join(
//     platformProjectRoot,
//     getBroadcastExtensionSetupUIName(props),
//     broadcastExtensionStoryBoardFileName
//   );
// }

// export function getBroadcastExtensionStoryBoardContent() {
//   return `<?xml version="1.0" encoding="UTF-8"?>
//   <document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="13122.16" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="j1y-V4-xli">
//       <dependencies>
//           <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="13104.12"/>
//           <capability name="Safe area layout guides" minToolsVersion="9.0"/>
//           <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
//       </dependencies>
//       <scenes>
//           <!--Share View Controller-->
//           <scene sceneID="ceB-am-kn3">
//               <objects>
//                   <viewController id="j1y-V4-xli" customClass="ShareViewController" customModuleProvider="target" sceneMemberID="viewController">
//                       <view key="view" opaque="NO" contentMode="scaleToFill" id="wbc-yd-nQP">
//                           <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
//                           <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
//                           <color key="backgroundColor" red="0.0" green="0.0" blue="0.0" alpha="0.0" colorSpace="custom" customColorSpace="sRGB"/>
//                           <viewLayoutGuide key="safeArea" id="1Xd-am-t49"/>
//                       </view>
//                   </viewController>
//                   <placeholder placeholderIdentifier="IBFirstResponder" id="CEy-Cv-SGf" userLabel="First Responder" sceneMemberID="firstResponder"/>
//               </objects>
//           </scene>
//       </scenes>
//   </document>
//   `;
// }

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

// : [root]/ios/BroadcastExensionSetupUI/BroacastSetupViewController.swift
// export function getBroadcastExtensionSetupUIViewControllerPath(
//   platformProjectRoot: string
// ) {
//   return path.join(
//     platformProjectRoot,
//     broadcastExtensionSetupUIName,
//     broadcastExtensionSetupUIViewControllerFileName
//   );
// }

export function getBroadcastExtensionSetupUIViewControllerContent(
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
    path.resolve(__dirname, './BroadcastSetupViewController.swift'),
    'utf8'
  );

  return content
    .replaceAll('<SCHEME>', updatedScheme)
    .replaceAll('<GROUPIDENTIFIER>', groupIdentifier);
}
