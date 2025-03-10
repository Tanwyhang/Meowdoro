import { Tabs } from 'expo-router';
import { Clock, BarChart2 } from 'lucide-react-native';
import { Platform, useWindowDimensions } from 'react-native';
import MatchaColorPalette from '../ColorPalette';

export default function TabLayout() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  
  return (

    /** INITIALISE TAB WRAPPER */
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: MatchaColorPalette[5],
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? (isSmallScreen ? 80 : 90) : (isSmallScreen ? 60 : 70),
          paddingBottom: Platform.OS === 'ios' ? (isSmallScreen ? 25 : 30) : (isSmallScreen ? 8 : 10),
          paddingTop: Platform.OS === 'ios' ? 5 : 0,
        },
        tabBarActiveTintColor: '#FFFFFFFF',
        tabBarInactiveTintColor: '#B3B3C1FF',
        tabBarLabelStyle: {
          fontFamily: 'Poppins-Regular',
          fontSize: isSmallScreen ? 10 : 12,
          marginTop: isSmallScreen ? -5 : 0,
        },
        tabBarIconStyle: {
          marginTop: isSmallScreen ? 5 : 0,
        },
      }}>

      {/** Timer tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timer',
          tabBarIcon: ({ color, size }) => (
            <Clock size={isSmallScreen ? size - 2 : size} color={color} />
          ),
        }}
      />


      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <BarChart2 size={isSmallScreen ? size - 2 : size} color={color} />
          ),
        }}
      />
    </Tabs>


  );
}