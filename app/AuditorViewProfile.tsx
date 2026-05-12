import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { supabase } from "@/class/supabase-client";
import { AuditorSidebar } from "@/components/auditor-sidebar";
import { Navbar } from "@/components/navbar";
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
  useWindowDimensions,
} from "react-native";

export default function AuditorViewProfile() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAudits: 0,
    verificationAccuracy: 98.5,
    electionsAssigned: 1,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("auditor");
        setProfile(userProfile);

        // Get email from Supabase auth session
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.email) {
          setEmail(data.session.user.email);
        }

        // Load additional stats
        try {
          const auditLogs =
            await serviceFactory.auditorService.getAuditLogs(1000);
          setStats((prev) => ({
            ...prev,
            totalAudits: auditLogs?.length || 0,
          }));
        } catch (error) {
          console.error("Failed to load audit stats:", error);
        }
      } catch (error) {
        Alert.alert(
          "Error",
          serviceFactory.authService.getErrorMessage(
            error,
            "Failed to load profile",
          ),
        );
        router.replace("/AuditorSignup");
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
      <View style={styles.container}>
        <Navbar
          homeRoute="/AuditorDashboard"
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
        <View style={styles.mainContent}>
          {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a73e8" />
            <Text style={styles.loadingText}>Loading Profile...</Text>
          </View>
        </View>
      </View>
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
    <View style={styles.container}>
      <Navbar
        homeRoute="/AuditorDashboard"
        actions={[
          { label: "Logout", onPress: handleLogout, variant: "outline" },
        ]}
      />

      <View style={styles.mainContent}>
        {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
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
                    {profile.full_name?.charAt(0) || "A"}
                  </Text>
                </View>
                <View style={styles.nameSection}>
                  <Text style={styles.fullName}>
                    {profile.full_name || "Auditor"}
                  </Text>
                  <Text style={styles.firstName}>
                    {profile.full_name?.split(" ")[0] || "Auditor"}
                  </Text>
                  <Text style={styles.roleText}>Senior Auditor</Text>
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
                  label="Auditor ID"
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

            {/* Audit Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Audit Statistics</Text>

              <View style={styles.statsGrid}>
                <StatBox
                  label="Total Audits"
                  value={stats.totalAudits.toString()}
                  icon="📊"
                  color="#1a73e8"
                />
                <StatBox
                  label="Verification Accuracy"
                  value={`${stats.verificationAccuracy}%`}
                  icon="🎯"
                  color="#4caf50"
                />
                <StatBox
                  label="Elections Assigned"
                  value={stats.electionsAssigned.toString()}
                  icon="🗳️"
                  color="#ff9800"
                />
                <StatBox
                  label="Blockchain Records"
                  value="3"
                  icon="⛓️"
                  color="#9c27b0"
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
                  description="Access to all elections"
                />
                <PermissionItem
                  icon="✓"
                  label="Verify Votes"
                  description="Compare blockchain vs results"
                />
                <PermissionItem
                  icon="✓"
                  label="Audit Blockchain"
                  description="Check blockchain integrity"
                />
                <PermissionItem
                  icon="✓"
                  label="Generate Reports"
                  description="Create audit reports"
                />
                <PermissionItem
                  icon="✗"
                  label="Edit Elections"
                  description="Cannot modify election data"
                  disabled
                />
                <PermissionItem
                  icon="✗"
                  label="Delete Records"
                  description="Cannot delete system records"
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
      </View>
    </View>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

function InfoCard({ label, value, icon, color = "#1a73e8" }: InfoCardProps) {
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
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    fontSize: 16,
    color: "#d32f2f",
  },
  // Profile Header
  profileHeader: {
    padding: 20,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  nameSection: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  firstName: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    marginBottom: 2,
  },
  roleText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e8f5e9",
    borderRadius: 20,
    marginLeft: 16,
  },
  statusDot: {
    fontSize: 16,
    color: "#4caf50",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2e7d32",
  },
  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 14,
  },
  // Info Grid
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: "48%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  infoIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: "23%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    alignItems: "center",
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
  // Permission Card
  permissionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    padding: 16,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  permissionItemDisabled: {
    opacity: 0.6,
  },
  permissionIcon: {
    fontSize: 18,
    marginRight: 12,
    fontWeight: "bold",
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
    color: "#999",
  },
  permissionDescription: {
    fontSize: 12,
    color: "#666",
  },
  permissionDescriptionDisabled: {
    color: "#bbb",
  },
  // Activity List
  activityList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: "#999",
  },
  // Info Note
  infoNote: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#1a73e8",
    marginBottom: 20,
  },
  noteIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0a5fa8",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    color: "#0d47a1",
    lineHeight: 18,
  },
  backButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  backButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#e8e8e8",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333333",
  },
});
