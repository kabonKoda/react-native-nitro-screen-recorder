![React Native Nitro Screen Recorder](./banner.jpg)

# react-native-nitro-screen-recorder

> ⚠️ This package is currently in alpha and under active development. Please report any issues that you run across on either platform.

A React Native library powered by [NitroModules](https://nitro.margelo.com/) that provides comprehensive screen recording capabilities for both iOS and Android. Capture in-app content or global screen recordings with camera overlay support, audio recording, and extensive customization options.

## Features

- **In-App Recording** (iOS only) - Record your app's content with camera overlay
- **Global Screen Recording** - System-wide screen capture (iOS & Android)
- **Camera Integration** - Front/back camera overlay with customizable positioning
- **Audio Recording** - Microphone support with permission management
- **Event Listeners** - Real-time recording status updates
- **File Management** - Automatic file handling and cache management
- **Permission Management** - Built-in camera and microphone permission handling
- **React Hooks** - Convenient hooks for permissions and global recording management

## Demo

### iOS In-App Recording
![IOS_In-App (With Camera)](./ios_inapp.jpg)

### iOS Global Recording
![IOS_Global](./ios_global.jpg)

### Android Global Recording  
![Android_Global](./android_global.jpg)


## Installation

Using npm:
```sh
npm install react-native-nitro-screen-recorder react-native-nitro-modules
```

Using yarn:
```sh
yarn add react-native-nitro-screen-recorder react-native-nitro-modules
```

> `react-native-nitro-modules` is required as this library relies on [Nitro Modules](https://nitro.margelo.com/).

## Configuration

This library includes an Expo config plugin for automatic native configuration.

### Using Expo

Add the plugin to your `app.config.js` or `app.json`:

```js
export default {
  expo: {
    plugins: [
      [
        'react-native-nitro-screen-recorder',
        {
          enableCameraPermission: true,
          cameraPermissionText: "Allow $(PRODUCT_NAME) to access your camera for screen recording with camera overlay",
          enableMicrophonePermission: true,
          microphonePermissionText: "Allow $(PRODUCT_NAME) to access your microphone for screen recording with audio",
          iosAppGroupIdentifier: "group.com.yourcompany.yourapp.screenrecording",
          showPluginLogs: false
        }
      ]
    ]
  }
};
```

#### Plugin Configuration Options

| Option | Type | Platform | Default | Description |
|:-------|:-----|:---------|:--------|:------------|
| `enableCameraPermission` | `boolean` | iOS | `true` | Whether to enable camera permission for screen recording with camera overlay |
| `cameraPermissionText` | `string` | iOS | `"Allow $(PRODUCT_NAME) to access your camera for screen recording with camera overlay"` | Camera permission description text displayed in iOS permission dialog |
| `enableMicrophonePermission` | `boolean` | iOS, Android | `true` | Whether to enable microphone permission for screen recording with audio capture |
| `microphonePermissionText` | `string` | iOS | `"Allow $(PRODUCT_NAME) to access your microphone for screen recording with audio"` | Microphone permission description text displayed in iOS permission dialog |
| `disableExperimental` | `boolean` | iOS | `false` | Whether to disable the experimental Expo appExtensions configuration. When true, skips applying the broadcast extension configuration |
| `iosAppGroupIdentifier` | `string` | iOS | `"group.${PRODUCT_BUNDLE_IDENTIFIER}.screenrecording"` | App Group identifier used to share data between the main app and its extensions |
| `showPluginLogs` | `boolean` | iOS, Android | `false` | Whether to display detailed plugin logs during the build process |

# Using Bare Workflow (Non-Expo)

If you're using a bare React Native project (not using Expo), you'll need to manually configure the native iOS and Android projects.

## iOS Setup

### 1. Add Permissions to Info.plist

Add the following permissions to your `ios/YourApp/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to access your camera for screen recording with camera overlay</string>
<key>NSMicrophoneUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to access your microphone for screen recording with audio</string>
```

### 2. Create App Group

1. Open your project in Xcode
2. Select your main app target
3. Go to **Signing & Capabilities**
4. Click **+ Capability** and add **App Groups**
5. Create a new app group with identifier: `group.com.yourcompany.yourapp.screenrecording`
6. Add the App Group identifier to your `Info.plist`:

```xml
<key>AppGroupIdentifier</key>
<string>group.com.yourcompany.yourapp.screenrecording</string>
```

### 3. Create Broadcast Upload Extension

1. In Xcode, go to **File → New → Target**
2. Choose **Broadcast Upload Extension**
3. Name it `BroadcastExtension`
4. Set the bundle identifier to `com.yourcompany.yourapp.BroadcastExtension`

### 4. Configure Extension Files

1. Copy `SampleHandler.swift` from `node_modules/react-native-nitro-screen-recorder/expo-plugin/src/ios/SampleHandler.swift` to your `BroadcastExtension/` folder
2. Copy `BroadcastWriter.swift` from `node_modules/react-native-nitro-screen-recorder/expo-plugin/src/ios/BroadcastWriter.swift` to your `BroadcastExtension/` folder
3. Update the following values in `SampleHandler.swift`:
   - Replace `<GROUPIDENTIFIER>` with your app group identifier (e.g., `group.com.yourcompany.yourapp.screenrecording`)
   - Replace `<SCHEME>` with your app's custom URL scheme

### 5. Configure Extension Settings

1. Select the `BroadcastExtension` target in Xcode
2. Go to **Signing & Capabilities**
3. Add **App Groups** capability
4. Select the same app group you created earlier
5. Set the **Deployment Target** to match your main app
6. Ensure **ReplayKit.framework** is linked in **Build Phases → Link Binary With Libraries**

### 6. Update Extension Info.plist

Update `BroadcastExtension/Info.plist`:

```xml
<key>NSExtension</key>
<dict>
  <key>NSExtensionPointIdentifier</key>
  <string>com.apple.broadcast-services-upload</string>
  <key>NSExtensionPrincipalClass</key>
  <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
  <key>RPBroadcastProcessMode</key>
  <string>RPBroadcastProcessModeSampleBuffer</string>
</dict>
<key>AppGroupIdentifier</key>
<string>group.com.yourcompany.yourapp.screenrecording</string>
```

### 7. Create Extension Entitlements

Create `BroadcastExtension/BroadcastExtension.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>group.com.yourcompany.yourapp.screenrecording</string>
  </array>
</dict>
</plist>
```

Then in your extension target's **Build Settings**, set **Code Signing Entitlements** to `BroadcastExtension/BroadcastExtension.entitlements`.

## Android Setup

### 1. Add Permissions to AndroidManifest.xml

Add the following permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 2. Add Service Declaration

Add the screen recording service to your `AndroidManifest.xml` inside the `<application>` tag:

```xml
<service
    android:name="com.margelo.nitro.nitroscreenrecorder.ScreenRecordingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="mediaProjection" />
```

### 3. Update MainActivity

Add activity result handling to your `MainActivity.java` or `MainActivity.kt`:

#### For Java (MainActivity.java):

```java
import android.content.Intent;
import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder;
import android.util.Log;

@Override
public void onActivityResult(int requestCode, int resultCode, Intent data) {
  super.onActivityResult(requestCode, resultCode, data);
  Log.d("MainActivity", "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
  
  try {
    NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data);
  } catch (Exception e) {
    Log.e("MainActivity", "Error handling activity result: " + e.getMessage());
    e.printStackTrace();
  }
}
```

#### For Kotlin (MainActivity.kt):

```kotlin
import com.margelo.nitro.nitroscreenrecorder.NitroScreenRecorder
import android.content.Intent
import android.util.Log

override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
  super.onActivityResult(requestCode, resultCode, data)
  Log.d("MainActivity", "onActivityResult: requestCode=$requestCode, resultCode=$resultCode")
  
  try {
    NitroScreenRecorder.handleActivityResult(requestCode, resultCode, data)
  } catch (e: Exception) {
    Log.e("MainActivity", "Error handling activity result: ${e.message}")
    e.printStackTrace()
  }
}
```

## Important Notes

- Replace `group.com.yourcompany.yourapp.screenrecording` with your actual app group identifier
- Replace `com.yourcompany.yourapp` with your actual bundle identifier
- Ensure both your main app and broadcast extension have the same App Group configured
- Test thoroughly on physical devices as screen recording doesn't work in simulators
- Make sure your app has a custom URL scheme configured for deep linking

## Verification

After completing these steps:

1. Build and run your app on a physical device
2. Test global screen recording functionality
3. Verify that recorded files are properly saved and accessible
4. Check that permissions are properly requested when needed

Your bare React Native project should now have the same screen recording capabilities as an Expo project using the config plugin.

### Quick Start Example

Here's a complete example using the `useGlobalRecording` hook:

```tsx
import React, { useEffect } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { 
  useGlobalRecording, 
  useMicrophonePermission,
  startGlobalRecording,
  stopGlobalRecording 
} from 'react-native-nitro-screen-recorder';

export default function ScreenRecorderExample() {
  const { hasPermission, requestPermission } = useMicrophonePermission();
  const { recording, isLoading, isError, error, refetch } = useGlobalRecording({
    refetchOnAppForeground: true
  });

  useEffect(() => {
    if (recording) {
      Alert.alert(
        'Recording Complete!', 
        `Saved: ${recording.name}\nDuration: ${recording.duration}s\nSize: ${recording.size} bytes`
      );
    }
  }, [recording]);

  const handleStartRecording = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is needed for audio recording');
        return;
      }
    }
    
    startGlobalRecording();
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
        Screen Recorder Demo
      </Text>
      
      <Button title="Start Global Recording" onPress={handleStartRecording} />
      <Button title="Stop Recording" onPress={stopGlobalRecording} />
      
      {isLoading && <Text>Processing recording...</Text>}
      {isError && (
        <View>
          <Text>Error: {error?.message}</Text>
          <Button title="Retry" onPress={refetch} />
        </View>
      )}
      
      {recording && (
        <View style={{ marginTop: 20 }}>
          <Text>Latest Recording:</Text>
          <Text>Name: {recording.name}</Text>
          <Text>Duration: {recording.duration}s</Text>
          <Text>Size: {recording.size} bytes</Text>
        </View>
      )}
    </View>
  );
}
```

# Documentation

## Table of Contents

- [React Hooks](#react-hooks)
  - [`useCameraPermission()`](#usecamerapermission-permissionstate)
  - [`useMicrophonePermission()`](#usemicrophonepermission-permissionstate)
  - [`useGlobalRecording()`](#useglobalrecordinginput-globalrecordinghookoutput)
- [Permissions](#permissions)
  - [`getCameraPermissionStatus()`](#getcamerapermissionstatus-permissionstatus)
  - [`getMicrophonePermissionStatus()`](#getmicrophonepermissionstatus-permissionstatus)
  - [`requestCameraPermission()`](#requestcamerapermission-promisepermissionresponse)
  - [`requestMicrophonePermission()`](#requestmicrophonepermission-promisepermissionresponse)
- [In-App Recording](#in-app-recording)
  - [`startInAppRecording()`](#startinapprecordinginput-promisevoid)
  - [`stopInAppRecording()`](#stopinapprecording-void)
  - [`cancelInAppRecording()`](#cancelinapprecording-void)
- [Global Recording](#global-recording)
  - [`startGlobalRecording()`](#startglobalrecording-void)
  - [`stopGlobalRecording()`](#stopglobalrecording-void)
  - [`getLastGlobalRecording()`](#getlastglobalrecording-screenrecordingfile--undefined)
- [Event Listeners](#event-listeners)
  - [`addScreenRecordingListener()`](#addscreenrecordinglistenerlistener--void)
- [Utilities](#utilities)
  - [`clearCache()`](#clearcache-void)

## React Hooks

### `useCameraPermission(): PermissionState`

Returns whether the user has granted permission to use the Camera, or not. If the user doesn't grant Camera Permission, you cannot use camera overlay features.

**Platform:** iOS, Android

**Returns:** Object with `hasPermission` boolean and `requestPermission` function

**Example:**
```tsx
import { useCameraPermission } from 'react-native-nitro-screen-recorder';

const { hasPermission, requestPermission } = useCameraPermission();

if (!hasPermission) {
  return <PermissionScreen onPress={requestPermission} />;
} else {
  return <CameraRecordingScreen />;
}
```

### `useMicrophonePermission(): PermissionState`

Returns whether the user has granted permission to use the Microphone, or not. If the user doesn't grant Audio Permission, you can still record but without audio.

**Platform:** iOS, Android

**Returns:** Object with `hasPermission` boolean and `requestPermission` function

**Example:**
```tsx
import { useMicrophonePermission } from 'react-native-nitro-screen-recorder';

const { hasPermission, requestPermission } = useMicrophonePermission();
const canRecordAudio = hasPermission;

// Use in recording configuration
const recordingOptions = {
  enableMic: canRecordAudio,
  enableCamera: true,
  // ... other options
};
```

### `useGlobalRecording(input): GlobalRecordingHookOutput`

Subscribe to global recording lifecycle and expose the most recent finished file. Automatically handles the delay needed for file processing after recording ends.

**Platform:** iOS, Android

**Parameters:**
- `input.refetchOnAppForeground`: Refresh when app becomes active (useful if users stop recording while app is backgrounded)

**Returns:** Object with recording file, loading state, error state, and refetch function

**Example:**
```tsx
import { useGlobalRecording } from 'react-native-nitro-screen-recorder';

const { recording, isLoading, isError, error, refetch } = useGlobalRecording({
  refetchOnAppForeground: true
});

useEffect(() => {
  if (recording) {
    // Handle completed recording
    console.log('New recording:', recording.path);
    // e.g., uploadRecording(recording.path)
  }
}, [recording]);

// Show loading state
if (isLoading) {
  return <Text>Processing recording...</Text>;
}

// Show error state
if (isError) {
  return (
    <View>
      <Text>Error: {error?.message}</Text>
      <Button title="Try Again" onPress={refetch} />
    </View>
  );
}
```

## Permissions

### `getCameraPermissionStatus(): PermissionStatus`

Gets the current camera permission status without requesting permission.

**Platform:** iOS, Android

**Returns:** The current permission status for camera access

**Example:**
```typescript
import { getCameraPermissionStatus } from 'react-native-nitro-screen-recorder';

const status = getCameraPermissionStatus();
if (status === 'granted') {
  // Camera is available
}
```

### `getMicrophonePermissionStatus(): PermissionStatus`

Gets the current microphone permission status without requesting permission.

**Platform:** iOS, Android

**Returns:** The current permission status for microphone access

**Example:**
```typescript
import { getMicrophonePermissionStatus } from 'react-native-nitro-screen-recorder';

const status = getMicrophonePermissionStatus();
if (status === 'granted') {
  // Microphone is available
}
```

### `requestCameraPermission(): Promise<PermissionResponse>`

Requests camera permission from the user if not already granted. Shows the system permission dialog if permission hasn't been determined.

**Platform:** iOS, Android

**Returns:** Promise that resolves with the permission response

**Example:**
```typescript
import { requestCameraPermission } from 'react-native-nitro-screen-recorder';

const response = await requestCameraPermission();
if (response.status === 'granted') {
  // Permission granted, can use camera
}
```

### `requestMicrophonePermission(): Promise<PermissionResponse>`

Requests microphone permission from the user if not already granted. Shows the system permission dialog if permission hasn't been determined.

**Platform:** iOS, Android

**Returns:** Promise that resolves with the permission response

**Example:**
```typescript
import { requestMicrophonePermission } from 'react-native-nitro-screen-recorder';

const response = await requestMicrophonePermission();
if (response.status === 'granted') {
  // Permission granted, can record audio
}
```

## In-App Recording

### `startInAppRecording(input): Promise<void>`

Starts in-app screen recording with the specified configuration. Records only the current app's content, not system-wide screen content.

**Platform:** iOS only

**Parameters:**
- `input`: Configuration object containing recording options and callbacks

**Example:**
```typescript
import { startInAppRecording } from 'react-native-nitro-screen-recorder';

await startInAppRecording({
  options: {
    enableMic: true,
    enableCamera: true,
    cameraDevice: 'front',
    cameraPreviewStyle: { width: 100, height: 150, top: 30, left: 10 }
  },
  onRecordingFinished: (file) => {
    console.log('Recording saved:', file.path);
  }
});
```

### `stopInAppRecording(): void`

Stops the current in-app recording and saves the recorded video. The recording file will be provided through the onRecordingFinished callback.

**Platform:** iOS only

**Example:**
```typescript
import { stopInAppRecording } from 'react-native-nitro-screen-recorder';

stopInAppRecording(); // File will be available in onRecordingFinished callback
```

### `cancelInAppRecording(): void`

Cancels the current in-app recording without saving the video. No file will be generated and onRecordingFinished will not be called.

**Platform:** iOS only

**Example:**
```typescript
import { cancelInAppRecording } from 'react-native-nitro-screen-recorder';

cancelInAppRecording(); // Recording discarded, no file saved
```

## Global Recording

### `startGlobalRecording(): void`

Starts global screen recording that captures the entire device screen. Records system-wide content, including other apps and system UI. Requires screen recording permission on iOS.

**Platform:** iOS, Android

**Example:**
```typescript
import { startGlobalRecording } from 'react-native-nitro-screen-recorder';

startGlobalRecording();
// User can now navigate to other apps while recording continues
```

### `stopGlobalRecording(): void`

Stops the current global screen recording and saves the video. The recorded file can be retrieved using `getLastGlobalRecording()`.

**Note:** On iOS, a broadcast is ended by tapping the red broadcasting dot in the corner of the screen. On Android, it's handled via button.

**Platform:** Android only (iOS stops via system UI)

**Example:**
```typescript
import { stopGlobalRecording, getLastGlobalRecording } from 'react-native-nitro-screen-recorder';

stopGlobalRecording();
const file = getLastGlobalRecording();
if (file) {
  console.log('Global recording saved:', file.path);
}
```

### `getLastGlobalRecording(): ScreenRecordingFile | undefined`

Retrieves the most recently completed global recording file. Returns undefined if no global recording has been completed.

**Platform:** iOS, Android

**Returns:** The last global recording file or undefined if none exists

**Example:**
```typescript
import { getLastGlobalRecording } from 'react-native-nitro-screen-recorder';

const lastRecording = getLastGlobalRecording();
if (lastRecording) {
  console.log('Duration:', lastRecording.duration);
  console.log('File size:', lastRecording.size);
}
```

## Event Listeners

### `addScreenRecordingListener(listener): () => void`

Adds a listener for screen recording events (start, stop, error, etc.). Returns a cleanup function to remove the listener when no longer needed.

**Platform:** iOS, Android

**Parameters:**
- `listener`: Callback function that receives screen recording events

**Returns:** Cleanup function to remove the listener

**Example:**
```typescript
import { useEffect } from 'react';
import { addScreenRecordingListener } from 'react-native-nitro-screen-recorder';

useEffect(() => {
  const removeListener = addScreenRecordingListener((event) => {
    console.log("Event type:", event.type, "Event reason:", event.reason);
  });
  
  return () => removeListener();
}, []);
```

## Utilities

### `clearCache(): void`

Clears all cached recording files to free up storage space. This will delete temporary files but not files that have been explicitly saved.

**Platform:** iOS, Android

**Example:**
```typescript
import { clearCache } from 'react-native-nitro-screen-recorder';

clearCache(); // Frees up storage by removing temporary recording files
```

## Types

The library exports comprehensive TypeScript types for all functionality:

```typescript
// Permission types
export type PermissionStatus = 'denied' | 'granted' | 'undetermined';

export type PermissionResponse = {
  canAskAgain: boolean;
  granted: boolean;
  status: PermissionStatus;
  expiresAt: never | number;
};

// Hook types
export interface PermissionState {
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export interface GlobalRecordingHookInput {
  refetchOnAppForeground: boolean;
}

export interface GlobalRecordingHookOutput {
  recording: ScreenRecordingFile | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// Recording configuration
export type RecorderCameraStyle = {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  borderWidth?: number;
};

export type CameraDevice = 'front' | 'back';

export type RecordingOptions =
  | {
      enableMic: boolean;
      enableCamera: true;
      cameraPreviewStyle: RecorderCameraStyle;
      cameraDevice: CameraDevice;
    }
  | { 
      enableCamera: false; 
      enableMic: boolean; 
    };

export type InAppRecordingInput = {
  options: RecordingOptions;
  onRecordingFinished: (file: ScreenRecordingFile) => void;
};

// Recording file information
export interface ScreenRecordingFile {
  path: string;
  name: string;
  size: number;
  duration: number;
  enabledMicrophone: boolean;
}

// Event types
export interface ScreenRecordingEvent {
  type: 'global' | 'withinApp';
  reason: 'began' | 'ended';
}

export interface RecordingError {
  name: string;
  message: string;
}
```

## Platform Differences

### iOS
- **In-App Recording**: Full support with camera overlay
- **Global Recording**: Requires user interaction to stop (red status bar indicator)
- **Permissions**: Camera and microphone permissions handled automatically
- **App Extensions**: Uses broadcast extensions for global recording

### Android
- **In-App Recording**: Not supported (use global recording instead)
- **Global Recording**: Full programmatic control including stop functionality
- **Permissions**: Microphone permission required for audio recording
- **Media Projection**: Uses Android's MediaProjection API

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)