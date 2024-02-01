import React, { useState, useRef, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
  Text,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export default function App() {
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const breathingAnimation = useRef(null);

  // Converts speech to text by sending a base64 audio file to whisper API
  async function speechToText(audioUri) {
    const audioBase64 = await convertAudioToBase64(audioUri);
    try {
      const response = await fetch(
        "https://redsync.vercel.app/api/speechToText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audio: audioBase64 }),
        }
      );
      const data = await response.json();
      if (data.result) {
        setTranscription(data.result);
      } else {
        console.error("API did not return transcription");
      }
    } catch (error) {
      console.error("Error sending audio to server:", error);
    }
  }

  // Reads the user audio recording from its filepath and converts it to Base64 format for easier transmission
  const convertAudioToBase64 = async (audioUri) => {
    try {
      const fileContent = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileContent;
    } catch (error) {
      console.error("Error reading audio file:", error);
      return null;
    }
  };

  // confirming the audio file type for debugging
  const getFileExtension = (uri) => {
    return uri.split(".").pop();
  };

  // confirming speech to text conversion for debugging
  useEffect(() => {
    if (transcription) {
      console.log(transcription);
    }
  }, [transcription]);

  // request user mic access on load
  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  // start recording in wav format and save audio object in recording state variable
  async function startRecording() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recordingOptions = {
        android: {
          extension: ".wav",
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(recording);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  // stop recording and use the filepath to play audio and convert it to text
  async function stopRecording() {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      playSound(uri);
      speechToText(uri);
      console.log(getFileExtension(uri));
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  }

  // play audio from filepath
  async function playSound(uri) {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (error) {
      console.error("Failed to play sound", error);
    }
  }

  // toggle agent circle animation, and start or stop recording accordingly.
  function toggleBreathingAnimation() {
    if (isListening) {
      breathingAnimation.current.stop();
      setIsListening(false);
      scaleAnimation.setValue(1);
      stopRecording();
    } else {
      breathingAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        {
          iterations: -1,
        }
      );
      breathingAnimation.current.start();
      setIsListening(true);
      startRecording();
    }
  }

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={toggleBreathingAnimation}>
        <Animated.View
          style={[
            styles.circle,
            {
              transform: [{ scale: scaleAnimation }],
            },
          ]}
        />
      </TouchableWithoutFeedback>
      <Text style={[styles.listeningText, { opacity: isListening ? 1 : 0 }]}>
        listening...
      </Text>
      <Text style={[styles.listeningText]}>{transcription}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "red",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  listeningText: {
    marginTop: 40,
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
});
