import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, useWindowDimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MatchaColorPalette, LimeColorPalette } from '../ColorPalette';
import SessionTracker from '@/utils/SessionTracker';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { UserCircle } from 'lucide-react-native';

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

// Main PomodoroTimer component
export default function PomodoroTimer() {
  const router = useRouter();
  
  // Session time variables for easy debugging (in seconds)
  const WORK_SESSION_TIME = 25 * 60; // 25 minutes
  const BREAK_SESSION_TIME = 5 * 60; // 5 minutes

  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;

  const CIRCLE_SIZE = Math.min(width * 0.8, height * 0.4);
  const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
  const CIRCLE_2_RADIUS = CIRCLE_RADIUS - 15;
  const CIRCLE_3_RADIUS = CIRCLE_RADIUS - 30;
  const STROKE_WIDTH = isSmallScreen ? 12 : 15;

  // STATE with setters
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WORK_SESSION_TIME);
  const [totalTime, setTotalTime] = useState(WORK_SESSION_TIME);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Session tracker
  const sessionTracker = SessionTracker.getInstance();

  // ANIMATED values
  const progress = useSharedValue(0);
  const breathingScale = useSharedValue(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play notification sound
  const playNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3')
      );
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  // Unload sound when component unmounts
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Toggle between work and break sessions
  const toggleSession = () => {
    // If is work session, check if it's being skipped or completed
    if (isWorkSession) {
      // If work session is being skipped (timer still has time left)
      if (timeLeft < totalTime && timeLeft > 0) {
        console.log('Skipping work session');
        sessionTracker.skipSession();
      } 
      // If the timer reached the end (timeLeft is 0), it's completed
      else if (timeLeft === 0) {
        console.log('Work session completed');
        sessionTracker.endSession(true);
      }
    }

    // Flip the session state: true (work) -> false (break) and vice versa
    const newIsWorkSession = !isWorkSession;
    setIsWorkSession(newIsWorkSession);
    
    // Set time based on session type using our variables
    const newTotalTime = newIsWorkSession ? WORK_SESSION_TIME : BREAK_SESSION_TIME;
    setTotalTime(newTotalTime);
    setTimeLeft(newTotalTime); // Reset the countdown

    // If transitioning FROM break TO work session, start a new session
    if (!isWorkSession && newIsWorkSession) {
      console.log('Transitioning from break to work, starting new session');
      sessionTracker.startSession();
    }

    // Smoothly reset progress animation over 500ms
    progress.value = withTiming(0, { 
      duration: 500, 
      easing: Easing.out(Easing.cubic) 
    });

    // Give a satisfying haptic buzz on mobile (skip for web)
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Force update the dashboard by calling loadSessions on the tracker
    sessionTracker.loadSessions().then(() => {
      console.log('Dashboard data refreshed');
    });
  };

  // Handle skip session with confirmation
  const handleSkipSession = () => {
    // On web, skip without confirmation
    if (Platform.OS === 'web') {
      toggleSession();
      return;
    }
    
    // On mobile, show confirmation dialog
    Alert.alert(
      "Skip Session",
      `Are you sure you want to skip this ${isWorkSession ? "work" : "break"} session?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Skip", 
          onPress: toggleSession,
          style: "destructive" 
        }
      ]
    );
  };

  // Start or pause the timer
  const toggleTimer = () => {

    if (isRunning) { // pause session
      console.log('pausing timer');
      sessionTracker.pauseSession();

      breathingScale.value = withTiming(1, { duration: 300 });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }


    } else { // resume session
      console.log('resuming timer');

      // If starting fresh (not resuming)
      if (timeLeft === totalTime && isWorkSession) {
        sessionTracker.startSession();
      } else {
        sessionTracker.resumeSession();
      }

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
            
            // Session completed successfully
            if (isWorkSession) {
              sessionTracker.endSession(true);
              
              // Explicitly refresh dashboard data
              sessionTracker.loadSessions().then(() => {
                console.log('Dashboard data refreshed after completion');
              });
            }
            
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

  // Update progress value when timeLeft changes
  useEffect(() => {
    if (totalTime > 0) {
      progress.value = withTiming(1 - timeLeft / totalTime, {
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
      });
    }

    // Check if the timer has completed
    if (timeLeft === 0 && !isRunning) {
      playNotificationSound();
      // Session will remain paused instead of auto-continuing
    }
  }, [timeLeft, totalTime]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // animated stroke dash offset
  const animatedStrokeDashoffset = useAnimatedStyle(() => {
    return {
      strokeDashoffset: interpolate(
        progress.value,
        [0, 1],
        [0, 2 * Math.PI * (CIRCLE_3_RADIUS - STROKE_WIDTH / 2)]
      ),
    } as any;
  });

  // Animated styles for the breathing effect
  const circleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: breathingScale.value }],
    };
  });

  return (
    <LinearGradient
      colors={["#EAF1E5FF", "#F4FFF0FF"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Login button at top right */}
        
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
              {/*Circle 1 outer*/}
              <Circle
                cx={CIRCLE_RADIUS}
                cy={CIRCLE_RADIUS}
                r={CIRCLE_RADIUS - STROKE_WIDTH / 2}
                stroke={isWorkSession ? MatchaColorPalette[3] : LimeColorPalette[3]}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={2 * Math.PI * (CIRCLE_RADIUS - STROKE_WIDTH / 2)}
                strokeLinecap="round"
                fill="transparent"
              />
              {/*Circle 2 mid*/}
              <Circle
                cx={CIRCLE_RADIUS}
                cy={CIRCLE_RADIUS}
                r={CIRCLE_2_RADIUS - STROKE_WIDTH / 2}
                stroke={isWorkSession ? MatchaColorPalette[4] : LimeColorPalette[4]}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={2 * Math.PI * (CIRCLE_2_RADIUS - STROKE_WIDTH / 2)}
                strokeLinecap="round"
                fill="transparent"
              />
              {/*Circle 3 inner*/}
              <Circle
                cx={CIRCLE_RADIUS}
                cy={CIRCLE_RADIUS}
                r={CIRCLE_3_RADIUS - STROKE_WIDTH / 2}
                stroke={isWorkSession ? MatchaColorPalette[5] : LimeColorPalette[5]}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={2 * Math.PI * (CIRCLE_3_RADIUS - STROKE_WIDTH / 2)}
                strokeLinecap="round"
                fill="transparent"
                strokeDashoffset={animatedStrokeDashoffset}
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
              styles.mainControlButton,
              isSmallScreen && styles.mainControlButtonSmall,
              isRunning && { opacity: 0.5 } // Lower opacity when running
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
            onPress={handleSkipSession}
          >
            <SkipForward size={isSmallScreen ? 28 : 32} color="#F5F5E0FF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: MatchaColorPalette[5],
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
    color: MatchaColorPalette[5],
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
    color: MatchaColorPalette[5],
  },
  timeTextSmall: {
    fontSize: 40,
  },
  sessionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 18,
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
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: MatchaColorPalette[5].slice(0, 7) + "85",
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  controlButtonSmall: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: MatchaColorPalette[5].slice(0, 7) + "85",
    marginHorizontal: 10,
  },
  mainControlButton: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: MatchaColorPalette[5],
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  mainControlButtonSmall: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: MatchaColorPalette[5],
    marginHorizontal: 15,
  },
  // Add this new style for the login button
  loginButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
});