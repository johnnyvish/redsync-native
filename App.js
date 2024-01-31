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

export default function App() {
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState(null);
  const breathingAnimation = useRef(null);

  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  async function startRecording() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      playSound(uri);
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  }

  async function playSound(uri) {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (error) {
      console.error("Failed to play sound", error);
    }
  }

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
