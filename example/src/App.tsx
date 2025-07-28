import { View, StyleSheet, Button, Text, ScrollView } from 'react-native';
import * as ScreenRecorder from 'react-native-nitro-screen-recorder';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';

export default function App() {
  const [inAppRecording, setInAppRecording] = useState<
    ScreenRecorder.ScreenRecordingFile | undefined
  >();
  const [globalRecording, setGlobalRecording] = useState<
    ScreenRecorder.ScreenRecordingFile | undefined
  >();

  useEffect(() => {
    const unsubscribe = ScreenRecorder.addScreenRecordingListener((event) => {
      console.log('EVENT CHANGE DETECTED', JSON.stringify(event, null, 2));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // @ts-ignore
  const inAppPlayer = useVideoPlayer(inAppRecording?.path);
  // @ts-ignore
  const globalPlayer = useVideoPlayer(globalRecording?.path);

  // Permission Functions
  const getCameraPermissionStatus = () => {
    console.log('Getting Camera Permission Status');
    ScreenRecorder.getCameraPermissionStatus().then((status) => {
      console.log(JSON.stringify(status, null, 2));
    });
  };

  const getMicrophonePermissionStatus = () => {
    console.log('Getting Microphone Permission Status');
    ScreenRecorder.getMicrophonePermissionStatus().then((status) => {
      console.log(JSON.stringify(status, null, 2));
    });
  };

  const requestCameraPermission = () => {
    console.log('Requesting Camera Permission');
    ScreenRecorder.requestCameraPermission().then((status) => {
      console.log(JSON.stringify(status, null, 2));
    });
  };

  const requestMicrophonePermission = () => {
    console.log('Requesting Mic Permission');
    ScreenRecorder.requestMicrophonePermission().then((status) => {
      console.log(JSON.stringify(status, null, 2));
    });
  };

  // Recording Options
  const options: ScreenRecorder.RecordingOptions = {
    enableMic: true,
    enableCamera: true,
    cameraPreviewStyle: {
      width: 100,
      height: 300,
      top: 30,
      left: 10,
      borderRadius: 10,
    },
    cameraDevice: 'front',
  };

  // In-App Recording Functions
  const handleStartInAppRecording = async () => {
    await ScreenRecorder.startInAppRecording({
      options,
      onRecordingFinished(file) {
        console.log(
          'In-app recording finished:',
          JSON.stringify(file, null, 2)
        );
        setInAppRecording(file);
      },
    });
  };

  const handleStopInAppRecording = () => {
    ScreenRecorder.stopInAppRecording();
  };

  const handleCancelInAppRecording = () => {
    ScreenRecorder.cancelInAppRecording();
    console.log('In-app recording cancelled');
  };

  // Global Recording Functions
  const handleStartGlobalRecording = async () => {
    await ScreenRecorder.startGlobalRecording();
  };

  const handleGetGlobalRecordingFile = () => {
    const latest = ScreenRecorder.getLatestGlobalRecording();
    setGlobalRecording(latest);
    console.log('Latest global recording:', JSON.stringify(latest, null, 2));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Permissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>

        <Text style={styles.permissionLabel}>Camera</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Check Camera"
              onPress={getCameraPermissionStatus}
              color="#007AFF"
            />
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title="Request Camera"
              onPress={requestCameraPermission}
              color="#007AFF"
            />
          </View>
        </View>

        <Text style={styles.permissionLabel}>Microphone</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Check Microphone"
              onPress={getMicrophonePermissionStatus}
              color="#007AFF"
            />
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title="Request Microphone"
              onPress={requestMicrophonePermission}
              color="#007AFF"
            />
          </View>
        </View>
      </View>

      {/* In-App Recording Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Recording</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Start Recording"
              onPress={handleStartInAppRecording}
              color="#34C759"
            />
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title="Stop Recording"
              onPress={handleStopInAppRecording}
              color="#FF3B30"
            />
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title="Cancel Recording"
              onPress={handleCancelInAppRecording}
              color="#FF9500"
            />
          </View>
        </View>
        <Text style={styles.playerLabel}>In-App Recording Player</Text>
        <VideoView player={inAppPlayer} style={styles.player} />
      </View>

      {/* Global Recording Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Global Recording</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <Button
              title="Start Global"
              onPress={handleStartGlobalRecording}
              color="#FF9500"
            />
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title="Get Latest File"
              onPress={handleGetGlobalRecordingFile}
              color="#FF9500"
            />
          </View>
        </View>
        <Text style={styles.playerLabel}>Global Recording Player</Text>
        <VideoView player={globalPlayer} style={styles.player} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    paddingTop: 32,
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3C3C43',
    marginTop: 8,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  buttonContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  playerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 4,
  },
  player: {
    backgroundColor: '#E5E5EA',
    height: 200,
    width: '100%',
    borderRadius: 8,
    marginTop: 8,
  },
});
