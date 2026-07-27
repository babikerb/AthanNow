import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Providers
import { OnboardingProvider } from './src/context/OnboardingContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { OnboardingOverlay } from './src/components/onboarding/OnboardingOverlay';
import { navigationRef } from './src/navigation/navigationRef';
import { ACCENT_ON_DARK } from './src/theme/colors';

// Translucent version of `ACCENT_ON_DARK` (see colors.ts's doc comment on
// that token) for the Android Material indicator pill's fill — the plain
// `ACCENT` was a real contrast problem here (a dark, desaturated green
// against the tab bar's near-black background reads as barely-there
// dark-on-dark), not just a stylistic preference.
const TAB_INDICATOR_COLOR = 'rgba(79, 174, 134, 0.35)';
// Side-effect import: defines the background-refresh task at module scope so the
// headless JS runtime can find it.
import { registerBackgroundRefresh } from './src/utils/backgroundRefresh';
import { configureNotificationHandler } from './src/utils/notifications';

// Foreground notification presentation behavior (set once at startup).
configureNotificationHandler();

// Screens
import AthanScreen from './src/screens/AthanScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import QiblaScreen from './src/screens/QiblaScreen';
import QuranScreen from './src/screens/QuranScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createNativeBottomTabNavigator();

function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
        {...({
          // Reverted from a custom-rendered tab bar (tried, for a Crumbl-
          // style abstract highlight) back to fully native, per explicit
          // preference. `activeIndicatorColor` is the native Android
          // Material 3 pill indicator; iOS 26+ renders its own Liquid Glass
          // pill automatically when the bar stays native.
          activeIndicatorColor: TAB_INDICATOR_COLOR,
        } as any)}
        tabBarActiveTintColor={ACCENT_ON_DARK}
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
      <OnboardingOverlay />
    </View>
  );
}

function Root() {
  const { ready } = useSettings();
  const [fontsLoaded] = useFonts({
    AmiriQuran: require('./assets/fonts/AmiriQuran-Regular.ttf'),
    // TODO(fonts): install `@expo-google-fonts/fraunces` (or add a static
    // Fraunces-SemiBold.ttf to assets/fonts) and uncomment the two lines
    // below to load the second headline typeface used by `type.hero` (see
    // src/theme/typography.ts's HEADLINE_FONT_FAMILY). Reserved for exactly
    // three moments: the onboarding wordmark, the Athan countdown, and the
    // Qibla degree readout. Until this is wired, `fontFamily:
    // 'Fraunces-SemiBold'` silently falls back to the system font at its
    // numeric fontWeight (800) — correct default RN behavior, so nothing
    // else needs to change once this is uncommented.
    //
    // import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
    // ...then add: 'Fraunces-SemiBold': Fraunces_600SemiBold,
  });

  // Hold on a neutral surface until persisted settings + the mushaf font load.
  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0B0B0D' }} />;
  // `MainTabs` always renders now — the merged onboarding flow
  // (`OnboardingOverlay`, mounted inside it) overlays the real tab screens
  // itself instead of preceding them with a separate full-screen flow, so it
  // can navigate through and highlight the real UI as part of the same
  // continuous experience. See `OnboardingContext`'s auto-start effect for
  // where `!onboardingComplete` now drives activation.
  return <MainTabs />;
}

export default function App() {
  // Register the periodic background refresh once at startup (idempotent).
  useEffect(() => {
    registerBackgroundRefresh();
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <OnboardingProvider>
            <StatusBar style="light" />
            <Root />
          </OnboardingProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
