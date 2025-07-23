import { View, StyleSheet, Button } from 'react-native';
import * as ScreenRecorder from 'react-native-nitro-screen-recorder';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';

const RECORDING_OPTIONS: ScreenRecorder.RecordingOptions = {
  enableCamera: true,
  enableMic: true,
};

export default function App() {
  const [recording, setRecording] =
    useState<ScreenRecorder.ScreenRecordingFile>({ path: '', duration: 0 });

  const player = useVideoPlayer(recording?.path);

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

  const handleStartRecording = async () => {
    await ScreenRecorder.startGlobalRecording(
      RECORDING_OPTIONS,
      (file) => {
        console.log('Finished with', file);
        setRecording(file);
      }
      // (error) => console.log('Error', error)
    );
  };

  return (
    <View style={styles.container}>
      <Button
        title="Get Camera Permission Status"
        onPress={getCameraPermissionStatus}
      />
      <Button
        title="Get Microphone Permission Status"
        onPress={getMicrophonePermissionStatus}
      />
      <Button
        title="Request Camera Permission"
        onPress={requestCameraPermission}
      />
      <Button
        title="Request Microphone Permission"
        onPress={requestMicrophonePermission}
      />
      <Button title="Start Screen Recording" onPress={handleStartRecording} />
      <Button
        title="Stop Screen Recording"
        onPress={ScreenRecorder.stopRecording}
      />
      <VideoView player={player} style={styles.player} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    backgroundColor: 'gray',
    height: 400,
    width: 300,
  },
});
