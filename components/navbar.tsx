import { useRouter } from "expo-router";
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type NavbarAction = {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline";
};

export type DashboardHomeRoute =
  | "/"
  | "/AdminDashboard"
  | "/VoterDashboard"
  | "/AuditorDashboard";

type NavbarProps = {
  actions?: NavbarAction[];
  infoText?: string;
  compact?: boolean;
  auditorName?: string;
  homeRoute?: DashboardHomeRoute;
};

export function Navbar({
  actions = [],
  infoText,
  compact = false,
  auditorName,
  homeRoute = "/",
}: NavbarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const insets = useSafeAreaInsets();

  const handleBrandPress = () => {
    router.replace(homeRoute);
  };

  return (
    <View
      style={[
        styles.navbar,
        compact && styles.navbarCompact,
        { paddingTop: insets.top + (compact ? 10 : 14) },
      ]}
    >
      {/* Top row: brand on left, action buttons on right */}
      <View style={[styles.topRow, compact && styles.topRowCompact]}>
        <Pressable
          style={({ pressed }) => [
            styles.brandWrap,
            pressed && styles.brandWrapPressed,
          ]}
          onPress={handleBrandPress}
        >
          <Image
            source={require("../assets/images/icon.png")}
            resizeMode="contain"
            style={[styles.brandLogo, compact && styles.brandLogoCompact]}
          />
          <View style={styles.brandTextContainer}>
            <Text
              style={[styles.brandName, compact && styles.brandNameCompact]}
            >
              VoteKro
            </Text>
            {auditorName && (
              <Text
                style={[
                  styles.auditorNameBrand,
                  compact && styles.auditorNameBrandCompact,
                ]}
              >
                {auditorName}
              </Text>
            )}
          </View>
        </Pressable>

        <View style={styles.actionsRow}>
          {/* On desktop, show infoText inline before buttons */}
          {!!infoText && !isMobile && (
            <Text style={[styles.infoText, compact && styles.infoTextCompact]}>
              {infoText}
            </Text>
          )}
          {actions.map((action, index) => {
            const isSolid = action.variant === "solid";
            return (
              <Pressable
                key={`${action.label}-${index}`}
                style={({ pressed }) => [
                  styles.actionButton,
                  compact && styles.actionButtonCompact,
                  isSolid
                    ? styles.actionButtonSolid
                    : styles.actionButtonOutline,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={action.onPress}
              >
                <Text
                  style={[
                    styles.actionText,
                    compact && styles.actionTextCompact,
                    isSolid ? styles.actionTextSolid : styles.actionTextOutline,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* On mobile, show infoText below the top row as a full-width second line */}
      {!!infoText && isMobile && (
        <Text
          style={[
            styles.infoTextMobile,
            compact && styles.infoTextMobileCompact,
          ]}
        >
          {infoText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#d9e0ec",
    zIndex: 2,
    boxShadow: "0px 2px 8px rgba(36, 59, 99, 0.06)",
    elevation: 2,
  },
  navbarCompact: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    flexWrap: "wrap",
    gap: 12,
  },
  topRowCompact: {
    minHeight: 40,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandWrapPressed: {
    opacity: 0.82,
  },
  brandTextContainer: {
    marginLeft: 8,
    flexDirection: "column",
  },
  brandName: {
    color: "#1a73e8",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  brandNameCompact: {
    fontSize: 26,
  },
  auditorNameBrand: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
    marginTop: 2,
  },
  auditorNameBrandCompact: {
    fontSize: 9,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandLogoCompact: {
    width: 28,
    height: 28,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  infoText: {
    fontSize: 14,
    color: "#5c6f89",
    fontWeight: "500",
    marginRight: 8,
  },
  infoTextCompact: {
    fontSize: 14,
    color: "#5c6f89",
    marginRight: 8,
  },
  infoTextMobile: {
    fontSize: 13,
    color: "#5c6f89",
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  infoTextMobileCompact: {
    color: "#2f64e6",
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  actionButtonCompact: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  actionButtonSolid: {
    backgroundColor: "#1a73e8",
    borderColor: "#1a73e8",
  },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderColor: "#1a73e8",
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionTextCompact: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionTextSolid: {
    color: "#ffffff",
  },
  actionTextOutline: {
    color: "#1a73e8",
  },
});
