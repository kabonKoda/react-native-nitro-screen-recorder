import { ConfigPlugin, withPlugins } from '@expo/config-plugins';

// Local helpers / sub‑mods ▶️
import { withMainAppAppGroupInfoPlist } from './withMainAppAppGroupInfoPlist';
import { withMainAppAppGroupEntitlement } from './withMainAppAppGroupEntitlement';
import { withBroadcastExtensionFiles } from './withBroadcastExtensionFiles';
import { withBroadcastExtensionXcodeProject } from './withBroadcastExtensionXcodeProject';
import { withBroadcastExtensionPodfile } from './withBroadcastExtensionPodfile';
import { withEasManagedCredentials } from './withEasManagedCredentials';

// Typed props that bubble all the way down to the sub‑mods
import type { ConfigProps } from '../@types';
import { withMainAppEntitlementsFile } from './withMainAppEntitlementsFile';

export const withBroadcastExtension: ConfigPlugin<ConfigProps> = (
  config,
  props
) => {
  return withPlugins(config, [
    /** Main‑app tweaks */
    [withMainAppAppGroupInfoPlist, props],
    [withMainAppEntitlementsFile, props],
    [withMainAppAppGroupEntitlement, props],

    /** Broadcast extension target */
    [withBroadcastExtensionFiles, props],
    [withBroadcastExtensionXcodeProject, props],
    [withBroadcastExtensionPodfile, props],

    /** Extras for EAS build */
    [withEasManagedCredentials, props],
  ]);
};
