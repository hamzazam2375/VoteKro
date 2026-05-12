import { usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export type SidebarItem = {
  label: string;
  icon: string;
  route: string;
  isActive?: boolean;
};

interface AuditorSidebarProps {
  onNavigate?: (route: string) => void;
  compact?: boolean;
  profileName?: string;
}

export function AuditorSidebar({ onNavigate, compact = false, profileName }: AuditorSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const navigationItems: SidebarItem[] = [
    { label: 'View Profile', icon: '👤', route: '/AuditorViewProfile' },
    { label: 'Overview', icon: '📊', route: '/AuditorDashboard' },
    { label: 'Elections', icon: '🗳️', route: '/AuditorElections' },
    { label: 'Blockchain', icon: '⛓️', route: '/AuditorBlockchainLedger' },
    { label: 'Reports', icon: '📋', route: '/AuditorReports' },
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
          const isActive = pathname.startsWith(item.route);
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
                  style={[
                    styles.navLabel,
                    isActive && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.sidebarFooter, compact && styles.sidebarFooterCompact]}>
        <View style={styles.userProfileCard}>
          <Text numberOfLines={1} style={styles.userProfileName}>
            {profileName?.trim() || "Auditor"}
          </Text>
          <Text style={styles.userProfileRole}>Auditor</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    flexDirection: 'column',
    paddingVertical: 20,
    paddingHorizontal: 12,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 50,
    minHeight: '100%',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: '#1a73e8',
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navItemCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
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
    fontWeight: '600',
    color: '#4a4a4a',
    flex: 1,
  },
  navLabelActive: {
    color: '#ffffff',
  },
  sidebarFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf0f5',
    marginTop: 'auto',
  },
  sidebarFooterCompact: {
    paddingHorizontal: 0,
  },
  userProfileCard: {
    backgroundColor: '#f6f8fc',
    borderWidth: 1,
    borderColor: '#e1e7f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userProfileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2e4a',
  },
  userProfileRole: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#5d6d86',
    textTransform: 'capitalize',
  },
});
