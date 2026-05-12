import { FaceRecognitionWebView } from "@/components/face-recognition-webview";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import "react-native-reanimated";

/* eslint-disable @typescript-eslint/no-require-imports -- web-only toast bundle */
const ToastContainer =
  Platform.OS === "web" ? require("react-toastify").ToastContainer : null;

if (Platform.OS === "web") {
  require("react-toastify/dist/ReactToastify.css");
}
/* eslint-enable @typescript-eslint/no-require-imports */

const stackHostStyle =
  Platform.OS === "web"
    ? ({ flex: 1, zIndex: 100000, position: "relative" as const } as const)
    : ({ flex: 1 } as const);

export default function RootLayout() {
  return (
    <>
      <View style={stackHostStyle}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="AdminLogin" options={{ headerShown: false }} />
          <Stack.Screen name="VoterLogin" options={{ headerShown: false }} />
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
          <Stack.Screen
            name="AuditorDashboard"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AuditorElections"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AuditorReports"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AuditorViewProfile"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AuditorVerifyVotes"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AuditorBlockchainLedger"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="VoterSignup" options={{ headerShown: false }} />
          <Stack.Screen
            name="AdminDashboard"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VoterDashboard"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VoterViewProfile"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CastVote/[electionId]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ElectionResults/[electionId]"
            options={{ headerShown: false }}
          />
        </Stack>
      </View>
      {ToastContainer ? (
        <ToastContainer
          position="bottom-right"
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
      <FaceRecognitionWebView />
      <StatusBar style="dark" />
    </>
  );
}
