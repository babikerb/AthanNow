import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Appearance, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Keep the native splash (icon on its exact background color, see
// app.json's `expo-splash-screen` config) on screen until settings + fonts
// are actually ready, instead of letting it auto-hide the instant the first
// JS frame draws — which would otherwise reveal the neutral loading `View`
// below for a beat, a visible color swap right after the splash.
SplashScreen.preventAutoHideAsync();

// Providers
import { OnboardingProvider } from './src/context/OnboardingContext';
import { LocationProvider } from './src/context/LocationContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ThemeProvider as DesignThemeProvider, useTheme as useDesignTheme } from './src/design/theme';
import { colorTokens } from './src/design/tokens';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { OnboardingOverlay } from './src/components/onboarding/OnboardingOverlay';
import { navigationRef } from './src/navigation/navigationRef';

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

// Decision (BRAND.md section 5, UI_LOOP_STATE standing decisions): keep the fully native UITabBar
// (iOS 26 Liquid Glass, native haptics). The library's custom `tabBar` slot renders in normal layout flow with no
// hit-testing outside its bounds, so a floating bar over the sky would shrink every screen and lose the glass bar.
// Styling comes from design tokens: accent tint = the one active-state marker, secondary text for the rest. No
// tabBarStyle background on purpose: a solid colour would replace the translucent glass/blur with a flat bar.
const tabIcon = (name: 'moon.stars' | 'calendar' | 'book' | 'safari' | 'gearshape', fill: boolean) =>
  ({ sfSymbol: fill && name !== 'calendar' ? `${name}.fill` : name }) as never;

function MainTabs() {
  const { c } = useDesignTheme();
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          tabBarActiveTintColor={c.accent}
          tabBarInactiveTintColor={c.textSecondary}
          hapticFeedbackEnabled
        >
        <Tab.Screen
          name="Athan"
          component={AthanScreen}
          options={{
            title: 'Athan',
            tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon('moon.stars', focused)
          } as any}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon('calendar', focused)
          } as any}
        />
        <Tab.Screen
          name="Quran"
          component={QuranScreen}
          options={{
            title: 'Quran',
            tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon('book', focused)
          } as any}
        />
        <Tab.Screen
          name="Qibla"
          component={QiblaScreen}
          options={{
            title: 'Qibla',
            tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon('safari', focused)
          } as any}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon('gearshape', focused)
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
    // Display face (BRAND.md): static SemiBold, family name matches design/tokens.json.
    'Fraunces-SemiBold': Fraunces_600SemiBold,
  });

  const appReady = ready && fontsLoaded;
  useEffect(() => {
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  // Hold on the same background color as the native splash (not the app's
  // usual near-black) until persisted settings + the mushaf font load, so the
  // transition from native splash to this view is invisible.
  if (!appReady) return <View style={{ flex: 1, backgroundColor: colorTokens.dark.bg }} />;
  // `MainTabs` always renders now — the merged onboarding flow
  // (`OnboardingOverlay`, mounted inside it) overlays the real tab screens
  // itself instead of preceding them with a separate full-screen flow, so it
  // can navigate through and highlight the real UI as part of the same
  // continuous experience. See `OnboardingContext`'s auto-start effect for
  // where `!onboardingComplete` now drives activation.
  return <MainTabs />;
}

/** Feeds the saved Appearance preference to the design theme and the native window (tab bar, keyboard, alerts). */
function AppThemes({ children }: { children: React.ReactNode }) {
  const { appearance } = useSettings();
  useEffect(() => {
    Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);
  return <DesignThemeProvider preference={appearance}>{children}</DesignThemeProvider>;
}

export default function App() {
  // Register the periodic background refresh once at startup (idempotent).
  useEffect(() => {
    registerBackgroundRefresh();
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <LocationProvider>
        <AppThemes>
          <ThemeProvider>
            <OnboardingProvider>
              <StatusBar style="light" />
              <Root />
            </OnboardingProvider>
          </ThemeProvider>
        </AppThemes>
        </LocationProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
