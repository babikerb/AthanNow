declare module 'react-native-shared-group-preferences' {
  const SharedGroupPreferences: {
    setItem(key: string, value: string, appGroup: string): Promise<void>;
    getItem(key: string, appGroup: string): Promise<string | null>;
  };
  export default SharedGroupPreferences;
}
