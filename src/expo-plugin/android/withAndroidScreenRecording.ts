import {
  ConfigPlugin,
  withAndroidManifest,
  withMainActivity,
} from '@expo/config-plugins';
import { ConfigProps } from '../@types';
import { makePluginLogger } from '../ios/PluginLogger';

export const withAndroidScreenRecording: ConfigPlugin<ConfigProps> = (
  config,
  props = {}
) => {
  const l = makePluginLogger(props.showPluginLogs ?? false);

  // Add permissions and services to AndroidManifest.xml
  config = withAndroidManifest(config, (mod) => {
    l.step(
      'Adding screen recording permissions and services to AndroidManifest.xml'
    );

    const androidManifest = mod.modResults;
    const application = androidManifest.manifest.application?.[0];

    if (!application) {
      throw new Error('Could not find application in AndroidManifest.xml');
    }

    // Add required permissions (still needed for Global Recording)
    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.RECORD_AUDIO',
    ];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    requiredPermissions.forEach((permission) => {
      const existingPermission = androidManifest.manifest[
        'uses-permission'
      ]?.find((perm) => perm.$?.['android:name'] === permission);

      if (!existingPermission) {
        androidManifest.manifest['uses-permission']!.push({
          $: {
            'android:name': permission,
          },
        });
        l.info(`✅ Added permission: ${permission}`);
      } else {
        l.info(`ℹ️ Permission already exists: ${permission}`);
      }
    });

    if (!application.service) {
      application.service = [];
    }

    // Add only the Global ScreenRecordingService
    const serviceName =
      'com.margelo.nitro.nitroscreenrecorder.ScreenRecordingService';
    const existingService = application.service?.find(
      (service) => service.$?.['android:name'] === serviceName
    );

    if (!existingService) {
      application.service!.push({
        $: {
          'android:name': serviceName,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        },
      });
      l.info(`✅ Added Global ScreenRecordingService to AndroidManifest.xml`);
    } else {
      l.info(
        `ℹ️ Global ScreenRecordingService already exists in AndroidManifest.xml`
      );
    }

    return mod;
  });

  // Modify MainActivity to handle activity results (still needed for Global Recording)
  config = withMainActivity(config, (mod) => {
    l.step('Modifying MainActivity for screen recording activity results');
    const { modResults } = mod;
    let mainActivityContent = modResults.contents;
    const isKotlin =
      mainActivityContent.includes('class MainActivity') &&
      (mainActivityContent.includes('override fun') ||
        mainActivityContent.includes('kotlin'));

    if (isKotlin) {
      mainActivityContent = addKotlinScreenRecordingSupport(
        mainActivityContent,
        l
      );
    } else {
      mainActivityContent = addJavaScreenRecordingSupport(
        mainActivityContent,
        l
      );
    }
    modResults.contents = mainActivityContent;
    return mod;
  });

  return config;
};

// This function remains unchanged as it's still needed for Global Recording
function addKotlinScreenRecordingSupport(content: string, l: any): string {
  // Required imports
  const requiredImports = [
    'import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder',
    'import android.content.Intent',
    'import android.util.Log',
  ];

  // Add imports if not present
  requiredImports.forEach((importStatement) => {
    if (!content.includes(importStatement)) {
      const importRegex = /(import\s+.*\n)/g;
      let lastImportMatch;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        lastImportMatch = match;
      }

      if (lastImportMatch) {
        const insertPosition =
          lastImportMatch.index + lastImportMatch[0].length;
        content =
          content.slice(0, insertPosition) +
          importStatement +
          '\n' +
          content.slice(insertPosition);
      }
    }
  });

  // Add onActivityResult method if not present
  if (!content.includes('onActivityResult')) {
    const classEndRegex = /(\s*)\}(\s*)$/;
    const match = content.match(classEndRegex);

    if (match) {
      const onActivityResultMethod = `
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    Log.d("MainActivity", "onActivityResult: requestCode=$requestCode, resultCode=$resultCode")
    
    try {
      // Handle screen recording activity results
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data)
    } catch (e: Exception) {
      Log.e("MainActivity", "Error handling activity result: \${e.message}")
      e.printStackTrace()
    }
  }
`;
      const insertPosition = match.index!;
      content =
        content.slice(0, insertPosition) +
        onActivityResultMethod +
        content.slice(insertPosition);
      l.info('✅ Added onActivityResult method to Kotlin MainActivity');
    }
  } else {
    if (!content.includes('NitroScreenRecorder.handleActivityResult')) {
      const onActivityResultRegex =
        /(override\s+fun\s+onActivityResult\s*\([^)]*\)\s*\{[^}]*)(super\.onActivityResult[^}]*)/;
      const match = content.match(onActivityResultRegex);

      if (match) {
        const screenRecordingHandler = `
    
    try {
      // Handle screen recording activity results
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data)
    } catch (e: Exception) {
      Log.e("MainActivity", "Error handling activity result: \${e.message}")
      e.printStackTrace()
    }`;
        if (match?.[1] && match?.[2]) {
          content = content.replace(
            onActivityResultRegex,
            match[1] + match[2] + screenRecordingHandler
          );

          l.info(
            '✅ Added screen recording handler to existing onActivityResult method'
          );
        }
      }
    } else {
      l.info(
        'ℹ️ Screen recording handler already exists in onActivityResult method'
      );
    }
  }
  return content;
}

// This function remains unchanged as it's still needed for Global Recording
function addJavaScreenRecordingSupport(content: string, l: any): string {
  const requiredImports = [
    'import android.content.Intent;',
    'import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder;',
    'import android.util.Log;',
  ];

  requiredImports.forEach((importStatement) => {
    if (!content.includes(importStatement)) {
      const importRegex = /(import\s+.*;\s*\n)/g;
      let lastImportMatch;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportMatch = match;
      }
      if (lastImportMatch) {
        const insertPosition =
          lastImportMatch.index + lastImportMatch[0].length;
        content =
          content.slice(0, insertPosition) +
          importStatement +
          '\n' +
          content.slice(insertPosition);
      }
    }
  });

  if (!content.includes('onActivityResult')) {
    const classEndRegex = /(\s*)\}(\s*)$/;
    const match = content.match(classEndRegex);
    if (match) {
      const onActivityResultMethod = `
  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    Log.d("MainActivity", "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
    
    try {
      // Handle screen recording activity results
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data);
    } catch (Exception e) {
      Log.e("MainActivity", "Error handling activity result: " + e.getMessage());
      e.printStackTrace();
    }
  }
`;
      const insertPosition = match.index!;
      content =
        content.slice(0, insertPosition) +
        onActivityResultMethod +
        content.slice(insertPosition);
      l.info('✅ Added onActivityResult method to Java MainActivity');
    }
  } else {
    if (!content.includes('NitroScreenRecorder.handleActivityResult')) {
      const onActivityResultRegex =
        /(@Override\s+public\s+void\s+onActivityResult\s*\([^)]*\)\s*\{[^}]*)(super\.onActivityResult[^}]*)/;
      const match = content.match(onActivityResultRegex);
      if (match) {
        const screenRecordingHandler = `
    
    try {
      // Handle screen recording activity results
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data);
    } catch (Exception e) {
      Log.e("MainActivity", "Error handling activity result: " + e.getMessage());
      e.printStackTrace();
    }`;
        if (match?.[1] && match?.[2]) {
          content = content.replace(
            onActivityResultRegex,
            match[1] + match[2] + screenRecordingHandler
          );

          l.info(
            '✅ Added screen recording handler to existing onActivityResult method'
          );
        }
      }
    } else {
      l.info(
        'ℹ️ Screen recording handler already exists in onActivityResult method'
      );
    }
  }
  return content;
}
