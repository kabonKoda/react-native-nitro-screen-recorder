import { ConfigProps } from './@types';

export const broadcastExtensionName = 'BroadcastExtension';
export const broadcastExtensionSetupUIName = 'BroadcastExtensionSetupUI';

export const broadcastExtensionSampleHandlerFileName = 'SampleHandler.swift';
export const broadcastExtensionStoryBoardFileName = 'MainInterface.storyboard';

export const broadcastExtensionSetupUIViewControllerFileName =
  'BroadcastSetupViewController.swift';

export const getBroadcastExtensionName = (parameters?: ConfigProps) => {
  if (!parameters?.iosBroadcastUploadExtensionName)
    return broadcastExtensionName;
  return parameters.iosBroadcastUploadExtensionName.replace(
    /[^a-zA-Z0-9]/g,
    ''
  );
};

export const getBroadcastExtensionSetupUIName = (parameters?: ConfigProps) => {
  if (!parameters?.iosBroadcastUploadExtensionSetupUIName)
    return broadcastExtensionSetupUIName;
  return parameters.iosBroadcastUploadExtensionSetupUIName.replace(
    /[^a-zA-Z0-9]/g,
    ''
  );
};

export const getAppGroup = (identifier: string, parameters: ConfigProps) => {
  return parameters.iosAppGroupIdentifier || `group.${identifier}`;
};

export const getBroadcastExtensionBundleIdentifier = (
  appIdentifier: string,
  parameters: ConfigProps
) => {
  return (
    parameters.iosBroadcastUploadExtensionBundleIdentifier ||
    `${appIdentifier}.broadcast-extension`
  );
};

export const getBroadcastExtensionSetupUIBundleIdentifier = (
  appIdentifier: string,
  parameters: ConfigProps
) => {
  return (
    parameters.iosBroadcastUploadExtensionSetupUIBundleIdentifier ||
    `${appIdentifier}.broadcast-extension-setup-ui`
  );
};
