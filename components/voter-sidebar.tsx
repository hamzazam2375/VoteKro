import { usePathname, useRouter } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

export type SidebarItem = {
  label: string;
  icon: string;
  route: string;
  isActive?: boolean;
};

interface VoterSidebarProps {
  onNavigate?: (route: string) => void;
  compact?: boolean;
  profileName?: string;
}

export function VoterSidebar({
  onNavigate,
  compact = false,
  profileName,
}: VoterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const navigationItems: SidebarItem[] = [
    { label: "Home", icon: "🏠", route: "/VoterDashboard" },
    { label: "History", icon: "📜", route: "/VoterDashboard?view=history" },
    {
      label: "View Profile",
      icon: "👤",
      route: "/VoterViewProfile",
    },
  ];

  const handleNavigation = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
    router.push(route as never);
  };

  if (isMobile && compact) {
    return null; // Hide on mobile when compact
  }

  return (
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <ScrollView
        style={styles.navContainer}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {navigationItems.map((item, index) => {
          const isActive = pathname.startsWith(item.route.split("?")[0]);
          return (
            <Pressable
              key={`${item.route}-${index}`}
              style={({ pressed }) => [
                styles.navItem,
                isActive && styles.navItemActive,
                pressed && styles.navItemPressed,
                compact && styles.navItemCompact,
              ]}
              onPress={() => handleNavigation(item.route)}
            >
              <Text style={[styles.navIcon, compact && styles.navIconCompact]}>
                {item.icon}
              </Text>
              {!compact && (
                <Text
                  style={[styles.navLabel, isActive && styles.navLabelActive]}
                >
                  {item.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[styles.sidebarFooter, compact && styles.sidebarFooterCompact]}
      >
        <View style={styles.userProfileCard}>
          <Text numberOfLines={1} style={styles.userProfileName}>
            {profileName?.trim() || "Voter"}
          </Text>
          <Text style={styles.userProfileRole}>Voter</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
    flexDirection: "column",
    paddingVertical: 20,
    paddingHorizontal: 12,
    overflow: "hidden",
    position: "relative",
    zIndex: 50,
    minHeight: "100%",
  },
  sidebarCompact: {
    width: 80,
    paddingHorizontal: 8,
  },
  navContainer: {
    flex: 1,
    minHeight: 0,
  },
  navContent: {
    gap: 8,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  navItemActive: {
    backgroundColor: "#2f64e6",
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navItemCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  navIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  navIconCompact: {
    marginRight: 0,
    fontSize: 18,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a4a4a",
    flex: 1,
  },
  navLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
    marginTop: 12,
  },
  sidebarFooterCompact: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 0,
  },
  userProfileCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userProfileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  userProfileRole: {
    fontSize: 11,
    color: "#5c6f89",
  },
});
