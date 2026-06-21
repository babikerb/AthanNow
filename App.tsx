import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Providers
import { ImmersiveProvider, useImmersive } from './src/context/ImmersiveContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { OnboardingTour } from './src/components/onboarding/OnboardingTour';
import { navigationRef } from './src/navigation/navigationRef';
import { configureNotificationHandler } from './src/utils/notifications';

// Foreground notification presentation behavior (set once at startup).
configureNotificationHandler();

// Screens
import AthanScreen from './src/screens/AthanScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import QiblaScreen from './src/screens/QiblaScreen';
import QuranScreen from './src/screens/QuranScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createNativeBottomTabNavigator();

function MainTabs() {
  // The Quran reader can request a full-bleed immersive mode that hides the bar.
  const { tabBarHidden } = useImmersive();
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
        {...({ tabBarHidden } as any)}
        tabBarActiveTintColor="#FFFFFF"
        screenOptions={{
          // Explicitly use the native background bar color property
          barTintColor: '#0B0B0D',
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
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: 'Calendar',
            tabBarIcon: () => ({ sfSymbol: 'calendar' })
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
      <OnboardingTour />
    </View>
  );
}

function Root() {
  const { ready, onboardingComplete } = useSettings();
  const [fontsLoaded] = useFonts({ AmiriQuran: require('./assets/fonts/AmiriQuran-Regular.ttf') });

  // Hold on a neutral surface until persisted settings + the mushaf font load.
  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0B0B0D' }} />;
  if (!onboardingComplete) return <OnboardingScreen />;
  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <ImmersiveProvider>
            <OnboardingProvider>
              <StatusBar style="light" />
              <Root />
            </OnboardingProvider>
          </ImmersiveProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
