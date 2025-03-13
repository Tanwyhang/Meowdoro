import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator, Animated, FlatList, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import MatchaColorPalette from '../ColorPalette';
import SessionTracker, { SessionData } from '../../utils/SessionTracker';
import { format, parseISO, subDays, isSameDay } from 'date-fns';
import { Clock, AlertCircle, RefreshCw, ChevronDown, ChevronUp, CheckCircle, SkipForward, Flame, BarChart2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

// Create a custom bar chart component to allow for rounded tops and labels
const CustomBarChart = ({data, width, height, style}: {data: { labels: string[], datasets: { data: number[] }[] }, width: number, height: number, style?: object}) => {
  const { labels, datasets } = data;
  const barData = datasets[0].data;
  // Adjust width calculation to allow more space between bars
  const barWidth = width * 0.6 / barData.length;
  const maxValue = Math.max(...barData, 1);
  
  // Function to format minutes as hours and minutes
  const formatTime = ({minutes} : {minutes: number}) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <View style={[styles.customChartContainer, style]}>
      <View style={styles.barsContainer}>
        {barData.map((value, index) => {
          const barHeight = (value / maxValue) * (height - 80);
          
          return (
            <View key={index} style={styles.barColumn}>
              <Text style={styles.barLabel}>{formatTime({ minutes: value })}</Text>
              <View 
                style={[
                  styles.barWrapper,
                  { height: Math.max(barHeight, 5) }
                ]}
              >
                <View 
                  style={[
                    styles.bar, 
                    { 
                      backgroundColor: MatchaColorPalette[4],
                      width: barWidth,
                    }
                  ]}
                />
              </View>
              <Text style={styles.axisLabel}>{labels[index]}</Text>
            </View>
          );
        })}
      </View>
      {/* Y-axis removed */}
    </View>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const isDesktopBrowser = width > 768 && Platform.OS === 'web';
  
  // Add a mounted ref to track component lifecycle
  const isMounted = useRef(false);
  
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [totalFocusedTime, setTotalFocusedTime] = useState(0);
  const [skipPercentage, setSkipPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<{day: string; minutes: number}[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [historyHeight] = useState(new Animated.Value(0));
  const [useTestData, setUseTestData] = useState(true);
  
  // Add pagination for session history
  const [displayedSessions, setDisplayedSessions] = useState<SessionData[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sessionsPerPage = 5;
  
  const sessionTracker = SessionTracker.getInstance();
  
  // Component mount effect
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    if (isMounted.current) {
      if (!useTestData) {
        loadData();
      } else {
        loadTestData();
      }
    }
  }, [useTestData]);

  // Separate test data loading into its own function and effect
  const loadTestData = () => {
    console.log("Setting test data");
    const testWeeklyData = [
      { day: 'Sun', minutes: 45 },
      { day: 'Mon', minutes: 75 },
      { day: 'Tue', minutes: 25 },
      { day: 'Wed', minutes: 60 },
      { day: 'Thu', minutes: 90 },
      { day: 'Fri', minutes: 30 },
      { day: 'Sat', minutes: 50 }
    ];
    
    // Create sessions with unique IDs and realistic data
    const testSessions = Array.from({ length: 100 }, (_, i) => {
      const startTime = new Date(Date.now() - i * 3600000).toISOString(); // Each session 1 hour apart
      const duration = 300 + Math.floor(Math.random() * 1500); // Random duration between 5-30 min
      return {
        id: `test-session-${i}`,
        startTime,
        endTime: new Date(Date.now() - i * 3600000 + duration * 1000).toISOString(), // Calculate end time
        duration,
        isCompleted: Math.random() > 0.2 // 80% completed, 20% skipped
      };
    });
    
    // Use the setState callbacks safely with mount check
    if (isMounted.current) {
      setWeeklyData(testWeeklyData);
      setSessions(testSessions);
      setTotalFocusedTime(25200); // 7 hours
      setSkipPercentage(25);
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('Dashboard focused, refreshing data');
      if (isMounted.current && !useTestData) {
        loadData();
      }
      return () => {};
    }, [useTestData])
  );

  // Update displayed sessions when main sessions array or page changes
  useEffect(() => {
    if (isMounted.current && sessions.length > 0) {
      setDisplayedSessions(sessions.slice(0, page * sessionsPerPage));
    }
  }, [sessions, page]);

  const loadData = async () => {
    if (!isMounted.current) return;
    
    setIsLoading(true);
    try {
      await sessionTracker.loadSessions();
      const allSessions = sessionTracker.getSessionsHistory();
      
      // Check if component is still mounted before updating state
      if (isMounted.current) {
        setSessions(allSessions);
        // Reset pagination when loading new data
        setDisplayedSessions(allSessions.slice(0, sessionsPerPage));
        setPage(1);
        setTotalFocusedTime(sessionTracker.getTotalFocusedTime());
        setSkipPercentage(sessionTracker.getSkipPercentage());
        
        // Prepare weekly chart data
        prepareWeeklyData(allSessions);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      // Check if component is still mounted before updating loading state
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };
  
  // Function to load more sessions when scrolling
  const loadMoreSessions = () => {
    if (isLoadingMore || displayedSessions.length >= sessions.length || !isMounted.current) {
      return;
    }
    
    setIsLoadingMore(true);
    
    setTimeout(() => {
      if (isMounted.current) {
        const nextPage = page + 1;
        setDisplayedSessions(sessions.slice(0, nextPage * sessionsPerPage));
        setPage(nextPage);
        setIsLoadingMore(false);
      }
    }, 300); // Small delay to prevent rapid loading
  };

  // Update prepareWeeklyData to check for mounted state
  const prepareWeeklyData = (sessions: SessionData[]) => {
    if (!sessions || sessions.length === 0 || !isMounted.current) {
      console.log("No sessions available for weekly data");
      return;
    }
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    // Initialize data for the past 7 days with clear date ranges
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      // Set to beginning of the day (midnight)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      return { 
        day: days[date.getDay()], 
        minutes: 0,
        completedMinutes: 0, // Track completed sessions separately
        skippedMinutes: 0,   // Track skipped sessions separately
        date: startOfDay,
        dayOfWeek: date.getDay()
      };
    });
    
    console.log(`Processing ${sessions.length} sessions for chart data`);
    
    // Calculate focus minutes for each day with more lenient date matching
    let matchedSessions = 0;
    sessions.forEach(session => {
      // Remove the filter for completed sessions to include all focus time
      if (!session.startTime) return;
      
      try {
        const sessionDate = parseISO(session.startTime);
        
        // Find matching day using the same logic as before
        let dayIndex = weekData.findIndex(d => {
          const sameDay = d.dayOfWeek === sessionDate.getDay();
          const withinRange = sessionDate >= weekData[0].date && 
                             sessionDate <= today;
          return sameDay && withinRange;
        });
        
        // Fall back to simpler date comparison if needed
        if (dayIndex < 0) {
          const sessionDateString = sessionDate.toISOString().split('T')[0];
          dayIndex = weekData.findIndex(d => 
            d.date.toISOString().split('T')[0] === sessionDateString
          );
        }
        
        if (dayIndex >= 0) {
          const minutes = session.duration / 60; // Convert seconds to minutes
          weekData[dayIndex].minutes += minutes; // Total minutes (both completed and skipped)
          
          // Track completed and skipped minutes separately for reporting
          if (session.isCompleted) {
            weekData[dayIndex].completedMinutes += minutes;
            console.log(`Added ${minutes.toFixed(1)} COMPLETED minutes to ${days[weekData[dayIndex].dayOfWeek]}`);
          } else {
            weekData[dayIndex].skippedMinutes += minutes;
            console.log(`Added ${minutes.toFixed(1)} SKIPPED minutes to ${days[weekData[dayIndex].dayOfWeek]}`);
          }
          
          matchedSessions++;
        }
      } catch (error) {
        console.error("Error processing session date:", error);
      }
    });
    
    console.log(`Matched ${matchedSessions} of ${sessions.length} sessions to days of the week`);
    
    // Format for chart display with debugging info, including breakdown of completed vs skipped
    const formattedData = weekData.map(d => {
      const result = { 
        day: d.day, 
        minutes: Math.round(d.minutes)  // This now includes both completed and skipped sessions
      };
      console.log(`${d.day}: ${result.minutes} minutes total (${Math.round(d.completedMinutes)} completed, ${Math.round(d.skippedMinutes)} skipped)`);
      return result;
    });
    
    console.log("Final weekly data for chart:", formattedData);
    
    // Check if component is still mounted before updating state
    if (isMounted.current) {
      setWeeklyData(formattedData);
    }
  };
  
  // Additional debugging in getChartData
  const getChartData = () => {
    if (!weeklyData || weeklyData.length === 0) {
      console.log("No weekly data available, using default zeros");
      const defaultData = {
        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
      };
      return defaultData;
    }
    
    console.log("Building chart data from:", weeklyData);
    
    // Ensure all 7 days are present with proper data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const completeData = days.map(day => {
      const found = weeklyData.find(item => item.day === day);
      const minutes = found ? found.minutes : 0;
      console.log(`${day}: ${minutes} minutes`);
      return {
        day,
        minutes: minutes
      };
    });
    
    const chartData = {
      labels: completeData.map(item => item.day),
      datasets: [{ 
        data: completeData.map(item => Math.max(0, item.minutes || 0)) // Ensure positive numbers
      }]
    };
    
    console.log("Final chart data:", chartData.datasets[0].data);
    return chartData;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  const toggleHistoryExpansion = () => {
    const newExpandedState = !isHistoryExpanded;
    setIsHistoryExpanded(newExpandedState);
    
    Animated.timing(historyHeight, {
      toValue: newExpandedState ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const completedSessionsCount = sessions.filter(s => s.isCompleted).length;
  const skippedSessionsCount = sessions.filter(s => !s.isCompleted).length;

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(107, 142, 35, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
  };

  const barData = getChartData();

  const toggleDataSource = () => {
    setUseTestData(!useTestData);
  };

  // Session item renderer for FlatList
  const renderSessionItem = ({ item }: { item: SessionData }) => (
    <View 
      style={[
        styles.sessionItem,
        item.isCompleted ? styles.completedSession : styles.skippedSession
      ]}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleContainer}>
          {item.isCompleted ? 
            <CheckCircle color={MatchaColorPalette[5]} size={16} style={styles.sessionIcon} /> : 
            <SkipForward color="#e6a919" size={16} style={styles.sessionIcon} />
          }
          <Text style={styles.sessionTitle}>
            {item.isCompleted ? 'Completed' : 'Skipped'}
          </Text>
        </View>
        <Text style={styles.sessionDuration}>
          {sessionTracker.formatFocusedTime(item.duration)}
        </Text>
      </View>
      <Text style={styles.sessionDate}>
        {formatDate(item.startTime)}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <LinearGradient colors={['#EAF1E5FF', '#F4FFF0FF']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MatchaColorPalette[5]} />
        <Text style={styles.loadingText}>Loading your focus data...</Text>
      </LinearGradient>
    );
  }
  
  // Create a desktop-specific layout
  if (isDesktopBrowser) {
    return (
      <LinearGradient
        colors={['#EAF1E5FF', '#F4FFF0FF']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Updated header to match mobile layout */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>
                ZenBoard
              </Text>
            </View>
          </View>

          <View style={styles.desktopContainer}>
            {/* Row 1: Focus Stats (25% height) */}
            <View style={styles.desktopStatsRow}>
              <View style={styles.desktopCard}>
                <View style={styles.desktopStatsGrid}>
                  <View style={styles.desktopStatItem}>
                    <Clock color={MatchaColorPalette[5]} size={28} style={styles.statIcon} />
                    <View>
                      <Text style={styles.statLabel}>Focus Time</Text>
                      <Text style={styles.desktopStatValue}>
                        {sessionTracker.formatFocusedTime(totalFocusedTime)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.desktopStatItem}>
                    <CheckCircle color={MatchaColorPalette[5]} size={28} style={styles.statIcon} />
                    <View>
                      <Text style={styles.statLabel}>Completed Sessions</Text>
                      <Text style={styles.desktopStatValue}>
                        {completedSessionsCount}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.desktopStatItem}>
                    <Flame color={MatchaColorPalette[5]} size={28} style={styles.statIcon} />
                    <View>
                      <Text style={styles.statLabel}>Success Rate</Text>
                      <Text style={styles.desktopStatValue}>
                        {sessions.length > 0 ? 
                          `${Math.round((completedSessionsCount / sessions.length) * 100)}%` : 
                          '0%'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.desktopStatItem}>
                    <BarChart2 color={MatchaColorPalette[5]} size={28} style={styles.statIcon} />
                    <View>
                      <Text style={styles.statLabel}>Total Sessions</Text>
                      <Text style={styles.desktopStatValue}>
                        {sessions.length}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Row 2: Weekly Chart and Session History (75% height) */}
            <View style={styles.desktopMainRow}>
              {/* Column 1: Weekly Chart */}
              <View style={styles.desktopMainColumn}>
                <View style={styles.desktopCard}>
                  <View style={styles.chartHeaderRow}>
                    <Text style={styles.desktopCardTitle}>Weekly Stats</Text>
                    {__DEV__ && (
                      <TouchableOpacity onPress={toggleDataSource} style={styles.dataSourceToggle}>
                        <Text style={styles.dataSourceText}>
                          {useTestData ? "Test Data" : "Real Data"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Custom chart with adjusted width */}
                  <CustomBarChart
                    data={barData}
                    width={width * 0.45 - 60}
                    height={300}
                    style={{ marginTop: 10, marginBottom: 10 }}
                  />
                </View>
              </View>

              {/* Column 2: Session History */}
              <View style={styles.desktopMainColumn}>
                <View style={styles.desktopCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.desktopCardTitle}>Session History</Text>
                    <View style={styles.historyControls}>
                      <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={loadData}
                      >
                        <RefreshCw color={MatchaColorPalette[5]} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.desktopHistorySummary}>
                    <View style={styles.desktopSummaryItem}>
                      <Text style={styles.desktopSummaryValue}>{completedSessionsCount}</Text>
                      <Text style={styles.desktopSummaryLabel}>Completed</Text>
                    </View>
                    <View style={styles.desktopSummaryItem}>
                      <Text style={styles.desktopSummaryValue}>{skippedSessionsCount}</Text>
                      <Text style={styles.desktopSummaryLabel}>Skipped</Text>
                    </View>
                    <View style={styles.desktopSummaryItem}>
                      <Text style={styles.desktopSummaryValue}>{sessions.length}</Text>
                      <Text style={styles.desktopSummaryLabel}>Total</Text>
                    </View>
                  </View>
                  
                  <ScrollView 
                    style={styles.desktopSessionListScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    {displayedSessions.map((session) => (
                      <View 
                        key={`session-${session.id}`}
                        style={[
                          styles.sessionItem,
                          session.isCompleted ? styles.completedSession : styles.skippedSession
                        ]}
                      >
                        <View style={styles.sessionHeader}>
                          <View style={styles.sessionTitleContainer}>
                            {session.isCompleted ? 
                              <CheckCircle color={MatchaColorPalette[5]} size={16} style={styles.sessionIcon} /> : 
                              <SkipForward color="#e6a919" size={16} style={styles.sessionIcon} />
                            }
                            <Text style={styles.sessionTitle}>
                              {session.isCompleted ? 'Completed' : 'Skipped'}
                            </Text>
                          </View>
                          <Text style={styles.sessionDuration}>
                            {sessionTracker.formatFocusedTime(session.duration)}
                          </Text>
                        </View>
                        <Text style={styles.sessionDate}>
                          {formatDate(session.startTime)}
                        </Text>
                      </View>
                    ))}
                    
                    {isLoadingMore && (
                      <ActivityIndicator 
                        size="small" 
                        color={MatchaColorPalette[5]} 
                        style={styles.loadMoreSpinner} 
                      />
                    )}
                    
                    {!isLoadingMore && displayedSessions.length < sessions.length && (
                      <TouchableOpacity onPress={loadMoreSessions} style={styles.loadMoreButton}>
                        <Text style={styles.loadMoreText}>Load more</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
          
          {/* Remove the separate login button at the bottom */}
        </SafeAreaView>
      </LinearGradient>
    );
  }
  
  // Mobile layout (unchanged)
  return (

    
    <LinearGradient
      colors={['#EAF1E5FF', '#F4FFF0FF']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Positioned blur header */}
        <View style={styles.blurHeaderContainer}>
          <BlurView intensity={30} tint="light" style={styles.blurView}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>
                ZenBoard
              </Text>
            </View>
          </BlurView>
        </View>

        {/* Platform fallback for Android */}
        {Platform.OS === 'android' && (
          <View style={[styles.headerFallback]} />
        )}

        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={{paddingTop: 60}} // Add padding for fixed header
          showsVerticalScrollIndicator={false} 
          nestedScrollEnabled={true}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCardHalf}>
              <Clock color={MatchaColorPalette[5]} size={24} style={styles.statIcon} />
              <View>
                <Text style={styles.statLabel}>Focus Time</Text>
                <Text style={styles.statValue}>
                  {sessionTracker.formatFocusedTime(totalFocusedTime)}
                </Text>
              </View>
            </View>
            
            <View style={styles.statCardHalf}>
              <AlertCircle color={MatchaColorPalette[5]} size={24} style={styles.statIcon} />
              <View>
                <Text style={styles.statLabel}>Sessions</Text>
                <Text style={styles.statValue}>
                  {sessions.filter(s => s.isCompleted).length}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Weekly Chart with our custom implementation */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Weekly Stats</Text>
              {__DEV__ && (
                <TouchableOpacity onPress={toggleDataSource} style={styles.dataSourceToggle}>
                  <Text style={styles.dataSourceText}>
                    {useTestData ? "Using Test Data" : "Using Real Data"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Replace the standard BarChart with our custom implementation */}
            <CustomBarChart
              data={barData}
              width={width * 0.9}
              height={220}
              style={{ marginTop: 10, marginBottom: 10 }}
            />
          </View>
          
          {/* Session History with Lazy Loading */}
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.chartTitle}>Session History</Text>
              <View style={styles.historyControls}>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadData}
                >
                  <RefreshCw color={MatchaColorPalette[5]} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={toggleHistoryExpansion}
                >
                  {isHistoryExpanded ? (
                    <ChevronUp color={MatchaColorPalette[5]} size={24} />
                  ) : (
                    <ChevronDown color={MatchaColorPalette[5]} size={24} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.historySummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Completed:</Text>
                <Text style={styles.summaryValue}>{completedSessionsCount}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Skipped:</Text>
                <Text style={styles.summaryValue}>{skippedSessionsCount}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={styles.summaryValue}>{sessions.length}</Text>
              </View>
            </View>
            
            {isHistoryExpanded && (
              <Animated.View 
                style={[
                  styles.sessionListContainer,
                  {
                    maxHeight: historyHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 200]
                    }),
                    opacity: historyHeight
                  }
                ]}
              >
                <ScrollView 
                  nestedScrollEnabled={true} 
                  style={{maxHeight: 200}}
                  showsVerticalScrollIndicator={false}
                >
                  {displayedSessions.map((session) => (
                    <View 
                      key={`session-${session.id}`}
                      style={[
                        styles.sessionItem,
                        session.isCompleted ? styles.completedSession : styles.skippedSession
                      ]}
                    >
                      <View style={styles.sessionHeader}>
                        <View style={styles.sessionTitleContainer}>
                          {session.isCompleted ? 
                            <CheckCircle color={MatchaColorPalette[5]} size={16} style={styles.sessionIcon} /> : 
                            <SkipForward color="#e6a919" size={16} style={styles.sessionIcon} />
                          }
                          <Text style={styles.sessionTitle}>
                            {session.isCompleted ? 'Completed' : 'Skipped'}
                          </Text>
                        </View>
                        <Text style={styles.sessionDuration}>
                          {sessionTracker.formatFocusedTime(session.duration)}
                        </Text>
                      </View>
                      <Text style={styles.sessionDate}>
                        {formatDate(session.startTime)}
                      </Text>
                    </View>
                  ))}
                  
                  {isLoadingMore && (
                    <ActivityIndicator 
                      size="small" 
                      color={MatchaColorPalette[5]} 
                      style={styles.loadMoreSpinner} 
                    />
                  )}
                  
                  {!isLoadingMore && displayedSessions.length < sessions.length && (
                    <TouchableOpacity onPress={loadMoreSessions} style={styles.loadMoreButton}>
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </TouchableOpacity>
                  )}
                  
                  {displayedSessions.length >= sessions.length && sessions.length > 0 && (
                    <Text style={styles.moreSessionsText}>End of sessions</Text>
                  )}
                  
                  {displayedSessions.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No sessions recorded yet.</Text>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            )}
          </View>
          
          
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Poppins-Regular',
    marginTop: 12,
    color: MatchaColorPalette[5],
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 21, // Increased from 16px to 21px
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
    marginLeft: 10,

  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: MatchaColorPalette[5],
    marginRight: 16, // Add spacing between title and button
  },
  titleSmall: {
    fontSize: 24,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: MatchaColorPalette[5],
    textAlign: 'center',
  },
  subtitleSmall: {
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap', // Allow wrapping on web
  },
  statCardHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    maxWidth: '48%', // Ensure no more than half width
    minWidth: 150, // Minimum width for small screens
  },
  statIcon: {
    marginRight: 12,
  },
  statLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: MatchaColorPalette[5],
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24, // Added bottom margin here for extra spacing
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  chartTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: MatchaColorPalette[5],
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(144, 238, 144, 0.2)',
    borderRadius: 20,
  },
  expandButton: {
    padding: 5,
  },
  historySummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: MatchaColorPalette[5],
  },
  sessionList: {
    flex: 1,
  },
  sessionItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  completedSession: {
    backgroundColor: 'rgba(144, 238, 144, 0.2)',
  },
  skippedSession: {
    backgroundColor: 'rgba(255, 214, 102, 0.2)',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sessionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIcon: {
    marginRight: 5,
  },
  sessionTitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: MatchaColorPalette[5],
  },
  sessionDuration: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: MatchaColorPalette[5],
  },
  sessionDate: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  moreSessionsText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  dataSourceToggle: {
    backgroundColor: 'rgba(144, 238, 144, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dataSourceText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: MatchaColorPalette[5],
  },
  // Add these new styles for our custom bar chart
  customChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: 200,
    width: '100%',
  
  },

  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingHorizontal: 5,
  },
  barWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    height: '100%',
  },
  barLabel: {
    fontFamily: 'Poppins-Bold', // Match other value styles
    fontSize: 12,
    color: MatchaColorPalette[5],
    marginBottom: 5,
  },
  axisLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },

  
  // New styles for the scrollable session list
  sessionListContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  // Loading and empty state styles
  loadMoreSpinner: {
    marginVertical: 10,
  },
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadMoreText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: MatchaColorPalette[5],
  },
  streakIconText: {
    fontSize: 18,
  },
  // Desktop-specific styles
  desktopContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 24,
    paddingBottom: 24,
  },
  desktopStatsRow: {
    flex: 0.25, // 25% of vertical space
    marginBottom: 16,
  },
  desktopMainRow: {
    flex: 0.75, // 75% of vertical space
    flexDirection: 'row',
    gap: 24,
  },
  desktopMainColumn: {
    flex: 1, // Equal width columns
  },
  desktopCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flex: 1,
    overflow: 'hidden',
  },
  desktopCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: MatchaColorPalette[5],
    marginBottom: 16,
  },
  desktopStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 13,
  },
  desktopStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '20%',
    backgroundColor: 'rgba(144, 238, 144, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  desktopSummaryItem: {
    alignItems: 'center',
  },
  desktopStatValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: MatchaColorPalette[5],
  },
  desktopSummaryValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: MatchaColorPalette[5],
  },
  desktopSummaryLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  desktopHistorySummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  desktopSessionListScroll: {
    flex: 1,
    maxHeight: 400,
  },
  // ...existing styles...
  chartNote: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  blurHeaderContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 10,
  },
  blurView: {
    paddingHorizontal: 21,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 9,
  },
});