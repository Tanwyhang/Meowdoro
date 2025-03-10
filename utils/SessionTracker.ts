import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { format } from 'date-fns';
import { Platform } from 'react-native';

export interface SessionData {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // in seconds
  isCompleted: boolean;
}

class SessionTracker {
  private static instance: SessionTracker;
  private sessions: SessionData[] = [];
  private currentSession: Partial<SessionData> | null = null;
  private readonly STORAGE_KEY = '@zendoro_sessions';
  private readonly CSV_KEY = 'zendoro_sessions_csv';
  private readonly CSV_PATH = Platform.OS !== 'web' ? `${FileSystem.documentDirectory}sessions.csv` : '';
  
  // Add variables to track pause time
  private pauseStartTime: number | null = null;
  private totalPauseTime: number = 0;

  private constructor() {
    // Private constructor for singleton
    this.loadSessions();
  }

  static getInstance(): SessionTracker {
    if (!SessionTracker.instance) {
      SessionTracker.instance = new SessionTracker();
    }
    return SessionTracker.instance;
  }

  async loadSessions(): Promise<void> {
    try {
      const storedSessions = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (storedSessions) {
        this.sessions = JSON.parse(storedSessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  async saveSessions(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessions));
      await this.updateCSV();
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  startSession(): void {
    // When we start a session, we record the current time
    const now = new Date();
    this.currentSession = {
      id: now.getTime().toString(),
      startTime: now.toISOString(),
    };
    // Reset pause tracking for new session
    this.pauseStartTime = null;
    this.totalPauseTime = 0;
    console.log('Session started at:', now.toISOString());
  }

  // Add pause tracking methods
  pauseSession(): void {
    if (!this.currentSession) return;
    
    // Start tracking pause time
    this.pauseStartTime = Date.now();
    console.log('Session paused at:', new Date(this.pauseStartTime).toISOString());
  }

  resumeSession(): void {
    if (!this.currentSession || this.pauseStartTime === null) return;
    
    // Calculate pause duration and add to total
    const now = Date.now();
    const pauseDuration = now - this.pauseStartTime;
    this.totalPauseTime += pauseDuration;
    
    console.log(`Resumed after pause of ${pauseDuration/1000}s, total pause: ${this.totalPauseTime/1000}s`);
    this.pauseStartTime = null; // Reset pause start time
  }

  endSession(isCompleted: boolean): void {
    if (!this.currentSession) return;
    
    const now = new Date();
    const endTime = now.toISOString();
    const startTime = new Date(this.currentSession.startTime!);
    
    // Calculate gross duration (wall clock time)
    const grossDuration = now.getTime() - startTime.getTime(); // in milliseconds
    
    // If there's an active pause when ending, account for it
    let totalPauseMs = this.totalPauseTime;
    if (this.pauseStartTime !== null) {
      totalPauseMs += (now.getTime() - this.pauseStartTime);
    }
    
    // Calculate net duration by excluding pause time
    const netDuration = Math.floor((grossDuration - totalPauseMs) / 1000); // in seconds
    
    const completedSession: SessionData = {
      id: this.currentSession.id!,
      startTime: this.currentSession.startTime!,
      endTime,
      duration: Math.max(0, netDuration), // Ensure duration is never negative
      isCompleted,
    };
    
    this.sessions.push(completedSession);
    console.log(`Session ended. Active duration: ${netDuration}s (excluding ${totalPauseMs/1000}s paused), completed: ${isCompleted}`);
    
    // Reset session tracking
    this.currentSession = null;
    this.pauseStartTime = null;
    this.totalPauseTime = 0;
    
    this.saveSessions();
  }

  skipSession(): void {
    if (this.currentSession) {
      this.endSession(false);
    }
  }

  getTotalFocusedTime(): number {
    return this.sessions.reduce((total, session) => {
      return total + session.duration;
    }, 0);
  }

  getSkipPercentage(): number {
    if (this.sessions.length === 0) return 0;
    
    const skippedSessions = this.sessions.filter(session => !session.isCompleted).length;
    return (skippedSessions / this.sessions.length) * 100;
  }

  getSessionsHistory(): SessionData[] {
    return [...this.sessions].sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }

  reset(): void {
    this.sessions = [];
    this.currentSession = null;
    this.pauseStartTime = null;
    this.totalPauseTime = 0;
    this.saveSessions();
  }

  private async updateCSV(): Promise<void> {
    try {
      // Create header
      const header = "id,startTime,endTime,duration,isCompleted\n";
      
      // Convert sessions to CSV rows
      const rows = this.sessions.map(session => {
        return `${session.id},${session.startTime},${session.endTime},${session.duration},${session.isCompleted}\n`;
      }).join("");
      
      const csvData = header + rows;
      
      if (Platform.OS === 'web') {
        // On web, use localStorage instead of FileSystem
        localStorage.setItem(this.CSV_KEY, csvData);
        console.log("CSV data saved to localStorage");
      } else {
        // On native platforms, use FileSystem
        const filePath = `${FileSystem.documentDirectory}sessions.csv`;
        await FileSystem.writeAsStringAsync(filePath, csvData);
        console.log("CSV updated at:", filePath);
      }
    } catch (error) {
      console.error('Error updating CSV:', error);
    }
  }

  formatFocusedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
  
  // Add function to share CSV
  async shareCSV(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        console.log('CSV sharing not available on web');
        return;
      }
      
      const Sharing = require('expo-sharing');
      const filePath = `${FileSystem.documentDirectory}sessions.csv`;
      
      await this.updateCSV();
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Share your focus session data',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        console.log('Sharing is not available on this platform');
      }
    } catch (error) {
      console.error('Error sharing CSV:', error);
    }
  }
}

export default SessionTracker;