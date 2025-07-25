import { ConfigProps } from './@types';

export const broadcastExtensionName = 'BroadcastExtension';
export const broadcastExtensionSetupUIName = 'BroadcastExtensionSetupUI';

export const broadcastExtensionSampleHandlerFileName = 'SampleHandler.swift';
export const broadcastExtensionStoryBoardFileName = 'MainInterface.storyboard';

export const broadcastExtensionSetupUIViewControllerFileName =
  'BroadcastSetupViewController.swift';

export const getAppGroup = (identifier: string, parameters: ConfigProps) => {
  return parameters.iosAppGroupIdentifier || `group.${identifier}`;
};

export const getBroadcastExtensionBundleIdentifier = (
  appIdentifier: string
) => {
  return `${appIdentifier}.broadcast-extension`;
};

export const getBroadcastExtensionSetupUIBundleIdentifier = (
  appIdentifier: string
) => {
  return `${appIdentifier}.broadcast-extension-setup-ui`;
};
