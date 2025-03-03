import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  withRepeat,
  cancelAnimation,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Import SVG components
import Svg, { Circle as SvgCircle } from 'react-native-svg';

// Use SvgCircle as Circle to avoid naming conflict
const Circle = SvgCircle;

export default function PomodoroTimer() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  
  // Calculate circle size based on screen dimensions
  const CIRCLE_SIZE = Math.min(width * 0.8, height * 0.4);
  const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
  const STROKE_WIDTH = isSmallScreen ? 12 : 15;
  const DOT_SIZE = isSmallScreen ? 8 : 10;
  const NUM_DOTS = 24;

  // Create an array of dots with their positions
  const createDots = (numDots: number) => {
    return Array.from({ length: numDots }).map((_, index) => {
      const angle = (index / numDots) * 2 * Math.PI;
      return { angle, index };
    });
  };

  const [isWorkSession, setIsWorkSession] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [totalTime, setTotalTime] = useState(25 * 60); // 25 minutes in seconds
  const dots = createDots(NUM_DOTS);
  
  const progress = useSharedValue(0);
  const dotRotation = useSharedValue(0);
  const breathingScale = useSharedValue(1);
  
  // Array of shared values for each dot's individual animation
  const dotAnimations = useRef(Array(NUM_DOTS).fill(0).map(() => useSharedValue(0))).current;
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle session toggle
  const toggleSession = () => {
    const newIsWorkSession = !isWorkSession;
    setIsWorkSession(newIsWorkSession);
    
    // Set appropriate time based on session type
    const newTotalTime = newIsWorkSession ? 25 * 60 : 5 * 60;
    setTotalTime(newTotalTime);
    setTimeLeft(newTotalTime);
    
    // Reset progress
    progress.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    
    // Reset dot animations
    dotAnimations.forEach(anim => {
      anim.value = 0;
    });
    
    // Trigger haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Start or pause the timer
  const toggleTimer = () => {
    if (isRunning) {
      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Slow down dot rotation with easing
      dotRotation.value = withTiming(dotRotation.value, { duration: 1000, easing: Easing.out(Easing.cubic) });
      
      // Start breathing animation when paused
      breathingScale.value = withRepeat(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        -1, // Infinite repetitions
        true // Reverse
      );
      
      // Pause dot animations
      dotAnimations.forEach(anim => {
        anim.value = withTiming(anim.value, { duration: 500, easing: Easing.out(Easing.cubic) });
      });
      
      // Trigger haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else {
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer completed
            clearInterval(timerRef.current!);
            timerRef.current = null;
            setIsRunning(false);
            
            // Switch to the other session type
            toggleSession();
            
            // Trigger haptic feedback for completion
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Resume dot rotation with smooth acceleration
      dotRotation.value = withTiming(dotRotation.value + 2 * Math.PI, {
        duration: 10000,
        easing: Easing.inOut(Easing.cubic),
      });
      
      // Start staggered dot animations
      dotAnimations.forEach((anim, index) => {
        anim.value = withDelay(
          index * 100, // 0.1s delay for each successive dot
          withSequence(
            withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
            withRepeat(
              withTiming(0.8, { 
                duration: 2000, 
                easing: Easing.inOut(Easing.cubic) 
              }),
              -1,
              true
            )
          )
        );
      });
      
      // Cancel breathing animation
      cancelAnimation(breathingScale);
      breathingScale.value = withTiming(1, { duration: 300 });
      
      // Trigger haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    
    setIsRunning(!isRunning);
  };

  // Reset the timer
  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setTimeLeft(totalTime);
    setIsRunning(false);
    progress.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    
    // Reset dot rotation with easing
    dotRotation.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    
    // Reset dot animations
    dotAnimations.forEach(anim => {
      anim.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    });
    
    // Cancel breathing animation
    cancelAnimation(breathingScale);
    breathingScale.value = withTiming(1, { duration: 300 });
    
    // Trigger haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  // Update progress value when timeLeft changes
  useEffect(() => {
    if (totalTime > 0) {
      progress.value = withTiming(1 - timeLeft / totalTime, {
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }, [timeLeft, totalTime]);

  // Start dot rotation animation when timer is running
  useEffect(() => {
    if (isRunning) {
      const rotationDuration = 20000; // 20 seconds for a full rotation
      
      // Continuous rotation animation
      const animate = () => {
        dotRotation.value = 0;
        dotRotation.value = withTiming(2 * Math.PI, {
          duration: rotationDuration,
          easing: Easing.linear,
        }, (finished) => {
          if (finished) {
            dotRotation.value = 0;
            animate();
          }
        });
      };
      
      animate();
    }
    
    return () => {
      cancelAnimation(dotRotation);
    };
  }, [isRunning]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Animated styles for the progress circle
  const circleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: breathingScale.value }],
    };
  });

  // Animated styles for the progress indicator
  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      strokeDashoffset: interpolate(
        progress.value,
        [0, 1],
        [2 * Math.PI * (CIRCLE_RADIUS - STROKE_WIDTH / 2), 0]
      ),
    };
  });

  // Dot component with animation
  function Dot({ angle, index, dotRotation, color }) {
    const dotAnimation = dotAnimations[index];
    
    const animatedStyle = useAnimatedStyle(() => {
      const x = Math.cos(angle + dotRotation.value) * (CIRCLE_RADIUS - STROKE_WIDTH / 2);
      const y = Math.sin(angle + dotRotation.value) * (CIRCLE_RADIUS - STROKE_WIDTH / 2);
      
      // Scale based on individual dot animation
      const scale = interpolate(
        dotAnimation.value,
        [0, 1],
        [0.6, 1.2]
      );
      
      // Opacity based on individual dot animation
      const opacity = interpolate(
        dotAnimation.value,
        [0, 1],
        [0.5, 1]
      );
      
      return {
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: scale }
        ],
        opacity: opacity,
      };
    });

    return (
      <Animated.View
        style={[
          {
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            position: 'absolute',
            top: CIRCLE_SIZE / 2 - DOT_SIZE / 2,
            left: CIRCLE_SIZE / 2 - DOT_SIZE / 2,
            backgroundColor: color,
          },
          animatedStyle,
        ]}
      />
    );
  }

  return (
    <LinearGradient
      colors={isWorkSession ? ['#1E1E2E', '#2C2C3E'] : ['#1E2E2E', '#2C3E3E']}
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
            {/* Background Circle */}
            <View style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              position: 'absolute',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }} />
            
            {/* Progress Circle */}
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
                stroke={isWorkSession ? '#FF6B6B' : '#4ECDC4'}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={2 * Math.PI * (CIRCLE_RADIUS - STROKE_WIDTH / 2)}
                strokeDashoffset={0}
                strokeLinecap="round"
                fill="transparent"
                style={progressAnimatedStyle}
              />
            </Svg>
            
            {/* Dots around the circle */}
            {dots.map((dot, index) => (
              <Dot
                key={index}
                angle={dot.angle}
                index={dot.index}
                dotRotation={dotRotation}
                color={isWorkSession ? '#FF6B6B' : '#4ECDC4'}
              />
            ))}
            
            {/* Timer Text */}
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
            <RotateCcw size={isSmallScreen ? 20 : 24} color="#8F8F9E" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.mainControlButton,
              { backgroundColor: isWorkSession ? '#FF6B6B' : '#4ECDC4' },
              isSmallScreen && styles.mainControlButtonSmall
            ]}
            onPress={toggleTimer}
          >
            {isRunning ? (
              <Pause size={isSmallScreen ? 28 : 32} color="#FFFFFF" />
            ) : (
              <Play size={isSmallScreen ? 28 : 32} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.controlButton,
              isSmallScreen && styles.controlButtonSmall
            ]}
            onPress={toggleSession}
          >
            <SkipForward size={isSmallScreen ? 20 : 24} color="#8F8F9E" />
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
    color: '#FFFFFF',
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
    color: '#8F8F9E',
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
    color: '#FFFFFF',
  },
  timeTextSmall: {
    fontSize: 40,
  },
  sessionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 18,
    color: '#8F8F9E',
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
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  controlButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginHorizontal: 10,
  },
  mainControlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  mainControlButtonSmall: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginHorizontal: 15,
  },
});