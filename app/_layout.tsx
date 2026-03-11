import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="AdminLogin" options={{ headerShown: false }} />
        <Stack.Screen name="VoterLogin" options={{ headerShown: false }} />
        <Stack.Screen name="AdminSignup" options={{ headerShown: false }} />
        <Stack.Screen name="AdminDashboard" options={{ headerShown: false }} />
        <Stack.Screen name="VoterDashboard" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
