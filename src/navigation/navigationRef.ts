import { createNavigationContainerRef } from '@react-navigation/native';

// Lets the onboarding tour switch tabs from outside the navigator tree.
export const navigationRef = createNavigationContainerRef();

export function navigateToTab(name: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never);
  }
}
