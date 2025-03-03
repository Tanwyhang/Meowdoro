import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Volume2, Vibrate, Moon, Info } from 'lucide-react-native';

export default function SettingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  
  const [notifications, setNotifications] = React.useState(true);
  const [sound, setSound] = React.useState(true);
  const [vibration, setVibration] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(true);

  return (
    <LinearGradient
      colors={['#1E1E2E', '#2C2C3E']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>Settings</Text>
          <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>
            Customize your Pomodoro experience
          </Text>
        </View>

        <ScrollView 
          style={styles.settingsContainer}
          contentContainerStyle={styles.settingsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingSection}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>
              Notifications
            </Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={isSmallScreen ? 18 : 22} color="#8F8F9E" />
                <Text style={[styles.settingText, isSmallScreen && styles.settingTextSmall]}>
                  Session Notifications
                </Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#3E3E4E', true: 'rgba(255, 107, 107, 0.4)' }}
                thumbColor={notifications ? '#FF6B6B' : '#8F8F9E'}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Volume2 size={isSmallScreen ? 18 : 22} color="#8F8F9E" />
                <Text style={[styles.settingText, isSmallScreen && styles.settingTextSmall]}>
                  Sound Effects
                </Text>
              </View>
              <Switch
                value={sound}
                onValueChange={setSound}
                trackColor={{ false: '#3E3E4E', true: 'rgba(255, 107, 107, 0.4)' }}
                thumbColor={sound ? '#FF6B6B' : '#8F8F9E'}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Vibrate size={isSmallScreen ? 18 : 22} color="#8F8F9E" />
                <Text style={[styles.settingText, isSmallScreen && styles.settingTextSmall]}>
                  Vibration
                </Text>
              </View>
              <Switch
                value={vibration}
                onValueChange={setVibration}
                trackColor={{ false: '#3E3E4E', true: 'rgba(255, 107, 107, 0.4)' }}
                thumbColor={vibration ? '#FF6B6B' : '#8F8F9E'}
              />
            </View>
          </View>
          
          <View style={styles.settingSection}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>
              Appearance
            </Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Moon size={isSmallScreen ? 18 : 22} color="#8F8F9E" />
                <Text style={[styles.settingText, isSmallScreen && styles.settingTextSmall]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#3E3E4E', true: 'rgba(255, 107, 107, 0.4)' }}
                thumbColor={darkMode ? '#FF6B6B' : '#8F8F9E'}
              />
            </View>
          </View>
          
          <View style={styles.settingSection}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>
              About
            </Text>
            
            <TouchableOpacity style={styles.aboutItem}>
              <View style={styles.settingInfo}>
                <Info size={isSmallScreen ? 18 : 22} color="#8F8F9E" />
                <Text style={[styles.settingText, isSmallScreen && styles.settingTextSmall]}>
                  About Pomodoro Timer
                </Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.versionContainer}>
              <Text style={[styles.versionText, isSmallScreen && styles.versionTextSmall]}>
                Version 1.0.0
              </Text>
            </View>
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
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 10,
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
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
  },
  subtitleSmall: {
    fontSize: 14,
  },
  settingsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingsContent: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  settingSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 15,
  },
  sectionTitleSmall: {
    fontSize: 16,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
  },
  settingTextSmall: {
    fontSize: 14,
    marginLeft: 12,
  },
  aboutItem: {
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#8F8F9E',
  },
  versionTextSmall: {
    fontSize: 12,
  },
});