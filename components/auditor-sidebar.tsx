import { useRouter, usePathname } from 'expo-router';
import React from 'react';
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
    router.push(route);
  };

  const handleLogout = async () => {
    try {
      const { serviceFactory } = await import('@/class/service-factory');
      await serviceFactory.authService.signOut();
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
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
              {isActive && !compact && (
                <View style={styles.activeIndicator} />
              )}
              {isActive && compact && (
                <View style={styles.activeIndicatorCompact} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Logout Button */}
      <View style={[styles.logoutSection, compact && styles.logoutSectionCompact]}>
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
            compact && styles.logoutButtonCompact,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutIcon}>🚪</Text>
          {!compact && <Text style={styles.logoutLabel}>Logout</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e7ff',
    flexDirection: 'column',
    paddingTop: 16,
    paddingBottom: 16,
    boxShadow: '0px 2px 8px rgba(26, 115, 232, 0.05)',
    elevation: 2,
  },
  sidebarCompact: {
    width: 80,
    paddingHorizontal: 8,
  },
  navContainer: {
    flex: 1,
  },
  navContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#f8faff',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#e8f4fd',
    borderLeftColor: '#1a73e8',
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navItemCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  navIconCompact: {
    marginRight: 0,
    fontSize: 22,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#525252',
    flex: 1,
  },
  navLabelActive: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a73e8',
    marginLeft: 'auto',
  },
  activeIndicatorCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1a73e8',
  },
  logoutSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 'auto',
  },
  logoutSectionCompact: {
    paddingHorizontal: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffe8e8',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  logoutButtonPressed: {
    opacity: 0.8,
  },
  logoutButtonCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d32f2f',
  },
});
