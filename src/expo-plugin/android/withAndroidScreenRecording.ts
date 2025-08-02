import {
  ConfigPlugin,
  withAndroidManifest,
  withMainActivity,
} from '@expo/config-plugins';

import { ConfigProps } from '../@types';
import { ScreenRecorderLog } from '../support/ScreenRecorderLog';

/**
 * Adds the Java / Kotlin glue code + manifest entries that our native
 * Android screen-recording module needs.
 */
export const withAndroidScreenRecording: ConfigPlugin<ConfigProps> = (
  config
) => {
  /* ------------------------------------------------------------------ */
  /* 1. AndroidManifest.xml                                             */
  /* ------------------------------------------------------------------ */
  config = withAndroidManifest(config, (mod) => {
    ScreenRecorderLog.log(
      'Adding screen-recording permissions and service to AndroidManifest.xml'
    );

    const androidManifest = mod.modResults;
    const application = androidManifest.manifest.application?.[0];
    if (!application) {
      throw new Error('Could not find <application> in AndroidManifest.xml');
    }

    /* ---------- permissions ----------------------------------------- */
    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.RECORD_AUDIO',
    ];
    androidManifest.manifest['uses-permission'] =
      androidManifest.manifest['uses-permission'] ?? [];

    requiredPermissions.forEach((permission) => {
      const exists = androidManifest.manifest['uses-permission']!.some(
        (perm) => perm.$?.['android:name'] === permission
      );
      if (!exists) {
        androidManifest.manifest['uses-permission']!.push({
          $: { 'android:name': permission },
        });
        ScreenRecorderLog.log(`✅ added permission ${permission}`);
      } else {
        ScreenRecorderLog.log(`ℹ️ permission already present ${permission}`);
      }
    });

    /* ---------- foreground service ---------------------------------- */
    const serviceName =
      'com.margelo.nitro.nitroscreenrecorder.ScreenRecordingService';
    application.service = application.service ?? [];

    const serviceExists = application.service.some(
      (s) => s.$?.['android:name'] === serviceName
    );
    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        },
      });
      ScreenRecorderLog.log('✅ added ScreenRecordingService');
    } else {
      ScreenRecorderLog.log('ℹ️ ScreenRecordingService already present');
    }

    return mod;
  });

  /* ------------------------------------------------------------------ */
  /* 2. MainActivity.java / .kt patch                                   */
  /* ------------------------------------------------------------------ */
  config = withMainActivity(config, (mod) => {
    ScreenRecorderLog.log(
      'Injecting onActivityResult handler into MainActivity'
    );

    const { modResults } = mod;
    let content = modResults.contents;
    const isKotlin =
      content.includes('class MainActivity') &&
      (content.includes('override fun') || content.includes('kotlin'));

    content = isKotlin
      ? patchKotlinMainActivity(content)
      : patchJavaMainActivity(content);

    modResults.contents = content;
    return mod;
  });

  return config;
};

/* ==================================================================== */
/*  Kotlin helper                                                       */
/* ==================================================================== */
function patchKotlinMainActivity(src: string): string {
  const imports = [
    'import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder',
    'import com.margelo.nitro.nitroscreenrecorder.ScreenRecorderLog',
    'import android.content.Intent',
  ];
  src = ensureImports(src, imports, false);

  /* inject onActivityResult if missing -------------------------------- */
  if (!src.includes('onActivityResult(')) {
    const body = `
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    ScreenRecorderLog.log("[MainActivity] onActivityResult requestCode=$requestCode resultCode=$resultCode")

    try {
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data)
    } catch (e: Exception) {
      ScreenRecorderLog.error("[MainActivity] error: \${e.message}")
      e.printStackTrace()
    }
  }`;
    src = insertBeforeClassEnd(src, body);
    ScreenRecorderLog.log('✅ added onActivityResult to Kotlin MainActivity');
  } else if (
    !src.includes('NitroScreenRecorder.handleActivityResult') &&
    src.includes('onActivityResult(')
  ) {
    // extend existing method
    const regex =
      /(override\s+fun\s+onActivityResult\s*\([^)]*\)\s*\{[^}]*)(super\.onActivityResult[^}]*)/;
    src = src.replace(
      regex,
      `$1$2

    try {
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data)
    } catch (e: Exception) {
      ScreenRecorderLog.error("[MainActivity] error: \${e.message}")
      e.printStackTrace()
    }`
    );
    ScreenRecorderLog.log(
      '✅ injected screen-recording handler into existing Kotlin onActivityResult'
    );
  }
  return src;
}

/* ==================================================================== */
/*  Java helper                                                         */
/* ==================================================================== */
function patchJavaMainActivity(src: string): string {
  const imports = [
    'import android.content.Intent;',
    'import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder;',
    'import com.margelo.nitro.nitroscreenrecorder.ScreenRecorderLog;',
  ];
  src = ensureImports(src, imports, true);

  if (!src.includes('onActivityResult(')) {
    const body = `
  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    ScreenRecorderLog.log("[MainActivity] onActivityResult requestCode=" + requestCode + " resultCode=" + resultCode);

    try {
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data);
    } catch (Exception e) {
      ScreenRecorderLog.error("[MainActivity] error: " + e.getMessage());
      e.printStackTrace();
    }
  }`;
    src = insertBeforeClassEnd(src, body);
    ScreenRecorderLog.log('✅ added onActivityResult to Java MainActivity');
  } else if (
    !src.includes('NitroScreenRecorder.handleActivityResult') &&
    src.includes('onActivityResult(')
  ) {
    const regex =
      /(@Override\s+public\s+void\s+onActivityResult\s*\([^)]*\)\s*\{[^}]*)(super\.onActivityResult[^}]*)/;
    src = src.replace(
      regex,
      `$1$2

    try {
      NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data);
    } catch (Exception e) {
      ScreenRecorderLog.error("[MainActivity] error: " + e.getMessage());
      e.printStackTrace();
    }`
    );
    ScreenRecorderLog.log(
      '✅ injected screen-recording handler into existing Java onActivityResult'
    );
  }
  return src;
}

/* ==================================================================== */
/*  tiny utilities                                                      */
/* ==================================================================== */

/**
 * Inserts any imports from `imports` that are missing in `src`.
 */
function ensureImports(src: string, imports: string[], java: boolean): string {
  const regex = java ? /(import\s+.*;\s*\n)/g : /(import\s+.*\n)/g;
  imports.forEach((imp) => {
    if (!src.includes(imp)) {
      let lastMatch: RegExpExecArray | null;
      let m: RegExpExecArray | null;
      lastMatch = null;
      while ((m = regex.exec(src)) !== null) lastMatch = m;
      if (lastMatch) {
        const insertPos = lastMatch.index + lastMatch[0].length;
        src = src.slice(0, insertPos) + imp + '\n' + src.slice(insertPos);
      }
    }
  });
  return src;
}

/**
 * Inserts `snippet` right before the last `}` of the class file.
 */
function insertBeforeClassEnd(src: string, snippet: string): string {
  const classEndRegex = /(\s*)\}(\s*)$/;
  const match = src.match(classEndRegex);
  if (match) {
    return (
      src.slice(0, match.index!) + snippet + '\n' + src.slice(match.index!)
    );
  }
  return src;
}
