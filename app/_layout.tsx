import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import "react-native-reanimated";

const ToastContainer =
  Platform.OS === "web" ? require("react-toastify").ToastContainer : null;

if (Platform.OS === "web") {
  require("react-toastify/dist/ReactToastify.css");
}

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="AdminLogin" options={{ headerShown: false }} />
        <Stack.Screen name="VoterLogin" options={{ headerShown: false }} />
        <Stack.Screen name="AdminSignup" options={{ headerShown: false }} />
        <Stack.Screen
          name="AdminCreateElection"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminManageElections"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminManageCandidates"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminViewResults"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="AuditorSignup" options={{ headerShown: false }} />
        <Stack.Screen name="VoterSignup" options={{ headerShown: false }} />
        <Stack.Screen name="AdminDashboard" options={{ headerShown: false }} />
        <Stack.Screen
          name="AuditorDashboard"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="VoterDashboard" options={{ headerShown: false }} />
      </Stack>
      {ToastContainer ? (
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
      ) : null}
      <StatusBar style="dark" />
    </>
  );
}
