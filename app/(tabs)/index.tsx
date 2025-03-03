import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import MatchaColorPalette from '../ColorPalette';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

const Circle = SvgCircle;

export default function PomodoroTimer() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;

  const CIRCLE_SIZE = Math.min(width * 0.8, height * 0.4);
  const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
  const STROKE_WIDTH = isSmallScreen ? 12 : 15;

  const [isWorkSession, setIsWorkSession] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);

  const progress = useSharedValue(0);
  const breathingScale = useSharedValue(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleSession = () => {
    const newIsWorkSession = !isWorkSession;
    setIsWorkSession(newIsWorkSession);
    const newTotalTime = newIsWorkSession ? 25 * 60 : 5 * 60;
    setTotalTime(newTotalTime);
    setTimeLeft(newTotalTime);
    progress.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toggleTimer = () => {

    // Pause the timer
    if (isRunning) {
      
      breathingScale.value = withTiming(1, { duration: 300 });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      // Start the timer
    } else {

      breathingScale.value = withRepeat(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true
      );

      timerRef.current = setInterval(() => {

        setTimeLeft((prev) => {

          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            setIsRunning(false);
            toggleSession();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(totalTime);
    setIsRunning(false);
    progress.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    cancelAnimation(breathingScale);
    breathingScale.value = withTiming(1, { duration: 300 });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  useEffect(() => {
    if (totalTime > 0) {
      progress.value = withTiming(1 - timeLeft / totalTime, {
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }, [timeLeft, totalTime]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const circleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: breathingScale.value }],
    };
  });

  return (
    <LinearGradient
      colors={isWorkSession ? ['#8BE3C2FF', '#FFFFFFFF'] : ['#1B1D21FF', '#3C5F5FFF']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>
            {isWorkSession ? 'Work Session' : 'Break Time'}
          </Text>
          <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>
            {isWorkSession ? 'Stay focused and productive' : 'Take a moment to relax'}
          </Text>
        </View>
        <View style={styles.timerContainer}>
          <Animated.View style={[
            {
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            },
            circleAnimatedStyle
          ]}>
            <View style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              position: 'absolute',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }} />
            <Svg
              width={CIRCLE_SIZE}
              height={CIRCLE_SIZE}
              style={{
                position: 'absolute',
                transform: [{ rotateZ: '-90deg' }],
              }}
            >
              <Circle
                cx={CIRCLE_RADIUS}
                cy={CIRCLE_RADIUS}
                r={CIRCLE_RADIUS - STROKE_WIDTH / 2}

                stroke={isWorkSession ? '#459D75FF' : '#338E47FF'}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={2 * Math.PI * (CIRCLE_RADIUS - STROKE_WIDTH / 2)}
                strokeLinecap="round"
                fill="transparent"
              />
            </Svg>
            <View style={styles.timeTextContainer}>
              <Text style={[
                styles.timeText,
                isSmallScreen && styles.timeTextSmall
              ]}>
                {formatTime(timeLeft)}
              </Text>
              <Text style={[
                styles.sessionText,
                isSmallScreen && styles.sessionTextSmall
              ]}>
                {isWorkSession ? 'Focus' : 'Break'}
              </Text>
            </View>
          </Animated.View>
        </View>
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isSmallScreen && styles.controlButtonSmall
            ]}
            onPress={resetTimer}
          >
            <RotateCcw size={isSmallScreen ? 20 : 24} color="#F5F5E0FF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.mainControlButton,
              
              isSmallScreen && styles.mainControlButtonSmall
            ]}
            onPress={toggleTimer}
          >
            {isRunning ? (
              <Pause size={isSmallScreen ? 28 : 32} color="#F5F5E0FF" />
            ) : (
              <Play size={isSmallScreen ? 28 : 32} color="#F5F5E0FF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isSmallScreen && styles.controlButtonSmall
            ]}
            onPress={toggleSession}
          >
            <SkipForward size={isSmallScreen ? 20 : 24} color="#F5F5E0FF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MatchaColorPalette.cream, // Light cream background for a soft, airy feel
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: MatchaColorPalette.cream, // Consistent light background
  },
  header: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: MatchaColorPalette.darkGreen, // Deep matcha green for emphasis
    marginBottom: 8,
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: MatchaColorPalette.mediumGreen, // Slightly lighter green for secondary text
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  subtitleSmall: {
    fontSize: 14,
    paddingHorizontal: 10,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  timeTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 48,
    color: MatchaColorPalette.darkGreen, // Matcha green for the main timer text
  },
  timeTextSmall: {
    fontSize: 40,
  },
  sessionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 18,
    color: '#8F8F9E', // Neutral gray for session labels (unchanged)
    marginTop: -5,
  },
  sessionTextSmall: {
    fontSize: 16,
    marginTop: -3,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#317651AC", // Soft pastel green for buttons
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  controlButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: MatchaColorPalette.darkGreen, // Consistent button color
    marginHorizontal: 10,
  },
  mainControlButton: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: '#206548FF', // Bold matcha green for the main button with transparency
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  mainControlButtonSmall: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: MatchaColorPalette.darkGreen + '2C', // Consistent bold green for smaller screens with transparency
    marginHorizontal: 15,
  },
});