import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="AdminLogin" options={{ headerShown: false }} />
        <Stack.Screen name="VoterLogin" options={{ headerShown: false }} />
        <Stack.Screen name="AdminSignup" options={{ headerShown: false }} />
        <Stack.Screen name="AuditorSignup" options={{ headerShown: false }} />
        <Stack.Screen name="VoterSignup" options={{ headerShown: false }} />
        <Stack.Screen name="AdminDashboard" options={{ headerShown: false }} />
        <Stack.Screen name="AuditorDashboard" options={{ headerShown: false }} />
        <Stack.Screen name="VoterDashboard" options={{ headerShown: false }} />
      </Stack>
      {Platform.OS === 'web' && (
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      )}
      <StatusBar style="dark" />
    </>
  );
}
