// updatePodfile.ts
import fs from 'fs';
import {
  BROADCAST_EXT_PODFILE_SNIPPET,
  BROADCAST_EXT_TARGET_NAME,
} from './iosConstants';
import { ScreenRecorderLog } from './ScreenRecorderLog';
import { FileManager } from './FileManager';

export async function updatePodfile(iosPath: string) {
  const podfilePath = `${iosPath}/Podfile`;
  let podfile = await FileManager.readFile(podfilePath);

  // Skip if already present
  if (podfile.includes(BROADCAST_EXT_TARGET_NAME)) {
    ScreenRecorderLog.log('Extension target already in Podfile. Skipping…');
    return;
  }

  // Inject snippet into every `target 'Something' do … end` that looks like an iOS app
  podfile = podfile.replace(/target ['"][^'"]+['"] do([\s\S]*?)end/g, (block) =>
    block.replace(/\nend$/, `${BROADCAST_EXT_PODFILE_SNIPPET}\nend`)
  );

  await fs.promises.writeFile(podfilePath, podfile, 'utf8');
  ScreenRecorderLog.log('Inserted BroadcastExtension into Podfile.');
}
