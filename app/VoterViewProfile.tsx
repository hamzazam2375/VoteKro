import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { supabase } from "@/class/supabase-client";
import { DashboardShell } from "@/components/dashboard-shell";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function VoterViewProfile() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalElections: 0,
    votedElections: 0,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("voter");
        setProfile(userProfile);

        // Get email from Supabase auth session
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.email) {
          setEmail(data.session.user.email);
        }

        // Load voting statistics
        try {
          const allElections =
            await serviceFactory.votingService.listAllElections();
          const votedIds =
            await serviceFactory.votingService.getMyVotedElectionIds();
          const votedCount = votedIds.length;

          setStats({
            totalElections: allElections.length,
            votedElections: votedCount,
          });
        } catch (error) {
          console.error("Failed to load voting stats:", error);
        }
      } catch (error) {
        Alert.alert(
          "Error",
          serviceFactory.authService.getErrorMessage(
            error,
            "Failed to load profile",
          ),
        );
        router.replace("/VoterDashboard");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      router.replace("/");
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(error, "Failed to logout"),
      );
    }
  };

  if (isLoading) {
    return (
      <DashboardShell
        compactNavbar
        homeRoute="/VoterDashboard"
        userName={profile?.full_name?.trim() || "Voter"}
        userRole="Voter"
        onLogout={handleLogout}
        sidebarItems={[
          {
            key: "home",
            label: "Home",
            icon: "🏠",
            active: false,
            onPress: () => router.push("/VoterDashboard"),
          },
          {
            key: "history",
            label: "History",
            icon: "📜",
            active: false,
            onPress: () => router.push("/VoterDashboard"),
          },
          {
            key: "profile",
            label: "View Profile",
            icon: "👤",
            active: true,
            onPress: () => router.push("/VoterViewProfile"),
          },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2f64e6" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <DashboardShell
      compactNavbar
      homeRoute="/VoterDashboard"
      userName={profile.full_name?.trim() || "Voter"}
      userRole="Voter"
      onLogout={handleLogout}
      sidebarItems={[
        {
          key: "home",
          label: "Home",
          icon: "🏠",
          active: false,
          onPress: () => router.push("/VoterDashboard"),
        },
        {
          key: "history",
          label: "History",
          icon: "📜",
          active: false,
          onPress: () => router.push("/VoterDashboard"),
        },
        {
          key: "profile",
          label: "View Profile",
          icon: "👤",
          active: true,
          onPress: () => router.push("/VoterViewProfile"),
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerWrapper}>
          <View style={styles.viewHeaderRow}>
            <Text style={styles.viewHeaderIcon}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.viewHeaderTitle}>Voter Profile</Text>
              <Text style={styles.viewHeaderSubtitle}>
                Review your account details and permissions.
              </Text>
            </View>
          </View>

          {/* Profile Header */}
          <LinearGradient
            colors={["#e8f4fd", "#f5fafe"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.avatarSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.full_name?.charAt(0) || "V"}
                </Text>
              </View>
              <View style={styles.nameSection}>
                <Text style={styles.fullName}>
                  {profile.full_name || "Voter"}
                </Text>
                <Text style={styles.firstName}>
                  {profile.full_name?.split(" ")[0] || "Voter"}
                </Text>
                <Text style={styles.roleText}>Registered Voter</Text>
              </View>
            </View>

            <View style={styles.statusBadge}>
              <Text style={styles.statusDot}>●</Text>
              <Text style={styles.statusText}>Active</Text>
            </View>
          </LinearGradient>

          {/* Profile Information Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>

            <View style={styles.infoGrid}>
              <InfoCard
                label="Voter ID"
                value={profile.user_id?.slice(0, 8).toUpperCase() || "N/A"}
                icon="🆔"
              />
              <InfoCard
                label="Email Address"
                value={email || "N/A"}
                icon="📧"
              />
              <InfoCard
                label="Account Status"
                value="Verified"
                icon="✓"
                color="#4caf50"
              />
              <InfoCard
                label="Joined Date"
                value={
                  profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "N/A"
                }
                icon="📅"
              />
            </View>
          </View>

          {/* Voting Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voting Statistics</Text>

            <View style={styles.statsGrid}>
              <StatBox
                label="Total Elections"
                value={stats.totalElections.toString()}
                icon="🗳️"
                color="#2f64e6"
              />
              <StatBox
                label="Elections Voted"
                value={stats.votedElections.toString()}
                icon="✓"
                color="#4caf50"
              />
            </View>
          </View>

          {/* Permissions & Role */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Role & Permissions</Text>

            <LinearGradient
              colors={["#f5fafe", "#ffffff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.permissionCard}
            >
              <PermissionItem
                icon="✓"
                label="View Elections"
                description="Access to all active elections"
              />
              <PermissionItem
                icon="✓"
                label="Cast Votes"
                description="Vote in eligible elections"
              />
              <PermissionItem
                icon="✓"
                label="View Results"
                description="See election results"
              />
              <PermissionItem
                icon="✓"
                label="Access Receipts"
                description="View your voting receipts"
              />
              <PermissionItem
                icon="✗"
                label="Edit Elections"
                description="Cannot modify election data"
                disabled
              />
              <PermissionItem
                icon="✗"
                label="Edit Profile"
                description="Cannot edit profile details"
                disabled
              />
            </LinearGradient>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <View style={styles.noteContent}>
              <Text style={styles.noteTitle}>Read-Only Profile</Text>
              <Text style={styles.noteText}>
                This is your profile information page. You cannot edit your
                profile details. Contact your administrator if you need to
                update your information.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </DashboardShell>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

function InfoCard({ label, value, icon, color = "#2f64e6" }: InfoCardProps) {
  return (
    <LinearGradient
      colors={["#ffffff", "#f8faff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.infoCard}
    >
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color }]}>{value}</Text>
    </LinearGradient>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

function StatBox({ label, value, icon, color }: StatBoxProps) {
  return (
    <LinearGradient
      colors={["#ffffff", "#f8faff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statBox}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
}

interface PermissionItemProps {
  icon: string;
  label: string;
  description: string;
  disabled?: boolean;
}

function PermissionItem({
  icon,
  label,
  description,
  disabled = false,
}: PermissionItemProps) {
  return (
    <View
      style={[styles.permissionItem, disabled && styles.permissionItemDisabled]}
    >
      <Text
        style={[
          styles.permissionIcon,
          { color: disabled ? "#ccc" : "#4caf50" },
        ]}
      >
        {icon}
      </Text>
      <View style={styles.permissionTextContent}>
        <Text
          style={[
            styles.permissionLabel,
            disabled && styles.permissionLabelDisabled,
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.permissionDescription,
            disabled && styles.permissionDescriptionDisabled,
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 900,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 280,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  viewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  viewHeaderIcon: {
    fontSize: 26,
  },
  viewHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1b2a47",
  },
  viewHeaderSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#5c6f89",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorText: {
    fontSize: 16,
    color: "#d32f2f",
  },
  profileHeader: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2f64e6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  nameSection: {
    flex: 1,
  },
  fullName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  firstName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  roleText: {
    fontSize: 12,
    color: "#2f64e6",
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    fontSize: 12,
    color: "#4caf50",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4caf50",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: 180,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 160,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  permissionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  permissionItemDisabled: {
    opacity: 0.6,
  },
  permissionIcon: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  permissionTextContent: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  permissionLabelDisabled: {
    color: "#ccc",
  },
  permissionDescription: {
    fontSize: 12,
    color: "#999",
  },
  permissionDescriptionDisabled: {
    color: "#ddd",
  },
  infoNote: {
    flexDirection: "row",
    backgroundColor: "#e3f2fd",
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  noteIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1565c0",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    color: "#0d47a1",
    lineHeight: 18,
  },
});
