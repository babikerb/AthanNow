import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Providers
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { configureNotificationHandler } from './src/utils/notifications';

// Foreground notification presentation behavior (set once at startup).
configureNotificationHandler();

// Screens
import AthanScreen from './src/screens/AthanScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import QiblaScreen from './src/screens/QiblaScreen';
import QuranScreen from './src/screens/QuranScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createNativeBottomTabNavigator();

function MainTabs() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        // minimizeBehavior shrinks the native tab bar on scroll (iOS 26+).
        {...({ minimizeBehavior: 'onScrollDown' } as any)}
        screenOptions={{
          // Explicitly use the native background bar color property
          barTintColor: '#0D1017',
        } as any}
      >
        <Tab.Screen
          name="Athan"
          component={AthanScreen}
          options={{
            title: 'Athan',
            tabBarIcon: () => ({ sfSymbol: 'moon.stars.fill' })
          } as any}
        />
        <Tab.Screen
          name="Quran"
          component={QuranScreen}
          options={{
            title: 'Quran',
            tabBarIcon: () => ({ sfSymbol: 'book.fill' })
          } as any}
        />
        <Tab.Screen
          name="Qibla"
          component={QiblaScreen}
          options={{
            title: 'Qibla',
            tabBarIcon: () => ({ sfSymbol: 'safari.fill' })
          } as any}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: () => ({ sfSymbol: 'gearshape.fill' })
          } as any}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function Root() {
  const { ready, onboardingComplete } = useSettings();
  const [fontsLoaded] = useFonts({ AmiriQuran: require('./assets/fonts/AmiriQuran-Regular.ttf') });

  // Hold on a neutral surface until persisted settings + the mushaf font load.
  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0D0A11' }} />;
  if (!onboardingComplete) return <OnboardingScreen />;
  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <Root />
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
