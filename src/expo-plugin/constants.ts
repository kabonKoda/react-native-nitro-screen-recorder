import type { ConfigProps } from './@types';

export const broadcastExtensionName = 'BroadcastExtension';

export const broadcastExtensionSampleHandlerFileName = 'SampleHandler.swift';
export const broadcastExtensionBroadcastWriterFileName =
  'BroadcastWriter.swift';
export const broadcastExtensionStoryBoardFileName = 'MainInterface.storyboard';

export const getAppGroup = (identifier: string, parameters: ConfigProps) => {
  return parameters.iosAppGroupIdentifier || `group.${identifier}`;
};

export const getBroadcastExtensionBundleIdentifier = (
  appIdentifier: string
) => {
  return `${appIdentifier}.broadcast-extension`;
};
