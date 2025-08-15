import path from 'path';
import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import { updatePodfile } from '../support/updatePodfile';
import { ScreenRecorderLog } from '../support/ScreenRecorderLog';
import { ConfigProps } from '../@types';

export const withBroadcastExtensionPodfile: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const iosRoot = path.join(mod.modRequest.projectRoot, 'ios');
      await updatePodfile(iosRoot, props).catch(ScreenRecorderLog.error);
      return mod;
    },
  ]);
};
