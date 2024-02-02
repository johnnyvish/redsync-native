import React, { useState, useRef, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
  Text,
  ScrollView,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const TypewriterText = ({ text, style, typingSpeed = 56 }) => {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setVisibleText("");

    const timer = setInterval(() => {
      if (visibleText.length < text.length) {
        setVisibleText((prevVisibleText) =>
          text.substring(0, prevVisibleText.length + 1)
        );
      } else {
        clearInterval(timer);
      }
    }, typingSpeed);

    return () => clearInterval(timer);
  }, [text, typingSpeed]);

  return <Text style={style}>{visibleText}</Text>;
};

export default function App() {
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState(null);
  const [gptResponse, setGptResponse] = useState(null);
  const breathingAnimation = useRef(null);
  const [showLoadingDots, setShowLoadingDots] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const scaleAnimations = useRef([
    new Animated.Value(0.5),
    new Animated.Value(0.5),
    new Animated.Value(0.5),
  ]).current;

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
        promptGPT(data.result);
      } else {
        console.error("API did not return transcription");
      }
    } catch (error) {
      console.error("Error sending audio to server:", error);
    }
  }

  // Sends the transcribed text to gpt and gets back the response
  async function promptGPT(text) {
    try {
      const response = await fetch("https://redsync.vercel.app/api/gpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (data.result) {
        setGptResponse(data.result);
        textToSpeech(data.result);
      } else {
        console.error("API did not return gpt response");
      }
    } catch (error) {
      console.error("Error sending prompt to gpt:", error);
    }
  }

  // Sends the gpt response to text-to-speech api and gets back the audio
  async function textToSpeech(text) {
    try {
      const response = await fetch(
        "https://redsync.vercel.app/api/textToSpeech",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      );
      if (response.status === 200) {
        const blob = await response.blob();
        const filePath = `${FileSystem.documentDirectory}audioResponse.mp3`;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result.split(",")[1];
            await FileSystem.writeAsStringAsync(filePath, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await playSound(filePath);
          } catch (error) {
            console.error("Error saving or playing the audio file:", error);
          }
        };
        reader.onerror = () => {
          console.error("Error converting blob to base64:", reader.error);
        };
        reader.readAsDataURL(blob);
      } else {
        console.error("API did not return tts");
      }
    } catch (error) {
      console.error("Error sending gpt response to tts:", error);
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

  // request user mic access on load
  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  // start recording in wav format and save audio object in recording state variable
  async function startRecording() {
    if (gptResponse) {
      setGptResponse(null);
    }
    setIsAudioPlaying(false);
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
      speechToText(uri);
      console.log(getFileExtension(uri));
      setShowLoadingDots(true);
      startLoadingAnimation();
      setTimeout(() => setShowLoadingDots(false), 2000); // Hide dots after 2 seconds
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  }

  // play audio from filepath
  async function playSound(uri) {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isPlaying) {
          setIsAudioPlaying(true);
        }
      });
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

  const startLoadingAnimation = () => {
    scaleAnimations.forEach((anim, index) => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.5,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 2 }
      );

      setTimeout(() => animation.start(), 200 * index);
    });
  };

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

      <View style={styles.textAndDotsContainer}>
        <Text
          style={[
            styles.listeningText,
            { opacity: isListening && !showLoadingDots ? 1 : 0 },
          ]}
        >
          listening...
        </Text>
        {showLoadingDots && (
          <View style={styles.loadingDots} pointerEvents="none">
            {scaleAnimations.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    transform: [{ scale: anim }],
                    backgroundColor: anim.interpolate({
                      inputRange: [0.5, 1],
                      outputRange: ["#30FFB7", "#07DEFF"],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.subtitlesContainer}>
        {gptResponse && isAudioPlaying && (
          <ScrollView
            style={{ flex: 1 }}
            ref={(ref) => {
              this.scrollView = ref;
            }}
            onContentSizeChange={() =>
              this.scrollView.scrollToEnd({ animated: true })
            }
          >
            <TypewriterText text={gptResponse} style={styles.subtitleText} />
          </ScrollView>
        )}
      </View>
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
  },
  listeningText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: "white",
    margin: 4,
    transform: [{ scale: 0.5 }],
  },
  textAndDotsContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    marginTop: 24,
  },
  subtitlesContainer: {
    height: 240,
    width: "75%",
    position: "absolute",
    bottom: 120,
    backgroundColor: "transparent",
  },
  subtitleText: {
    color: "white",
    fontSize: 24,
    textAlign: "left",
    fontWeight: "bold",
  },
});
