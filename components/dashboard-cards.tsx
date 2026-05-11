import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  subtext?: string;
  onPress?: () => void;
  accentColor?: string;
}

export function StatCard({
  label,
  value,
  icon = '📊',
  color = '#1a73e8',
  subtext,
  onPress,
  accentColor = '#0a7ea4',
}: StatCardProps) {
  const cardContent = (
    <View style={styles.cardContent}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && styles.cardPressed,
      ]}
    >
      <LinearGradient
        colors={['#e8f4fd', '#f5fafe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {cardContent}
        <View 
          style={[
            styles.borderAccent,
            { borderLeftColor: accentColor }
          ]}
        />
      </LinearGradient>
    </Pressable>
  );
}

interface MetricCardProps {
  title: string;
  metric: number;
  unit: string;
  icon: string;
  color?: string;
  progress?: number;
  onPress?: () => void;
}

export function MetricCard({
  title,
  metric,
  unit,
  icon,
  color = '#1a73e8',
  progress,
  onPress,
}: MetricCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCardContainer,
        pressed && styles.metricCardPressed,
      ]}
    >
      <LinearGradient
        colors={['#ffffff', '#f8faff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradient}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricIcon}>{icon}</Text>
          <Text style={styles.metricTitle}>{title}</Text>
        </View>

        <View style={styles.metricBody}>
          <Text style={[styles.metricValue, { color }]}>
            {metric}
          </Text>
          <Text style={styles.metricUnit}>{unit}</Text>
        </View>

        {progress !== undefined && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  buttonLabel: string;
  onPress: () => void;
  color?: string;
}

export function ActionCard({
  title,
  description,
  icon,
  buttonLabel,
  onPress,
  color = '#1a73e8',
}: ActionCardProps) {
  return (
    <View style={styles.actionCardContainer}>
      <LinearGradient
        colors={['#ffffff', '#f8faff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionGradient}
      >
        <View style={styles.actionHeader}>
          <Text style={styles.actionIcon}>{icon}</Text>
          <Text style={styles.actionTitle}>{title}</Text>
        </View>

        <Text style={styles.actionDescription}>{description}</Text>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <LinearGradient
            colors={[color, adjustColor(color, 20)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButtonGradient}
          >
            <Text style={styles.actionButtonText}>{buttonLabel}</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  const usePound = color[0] === '#';
  const col = usePound ? color.slice(1) : color;
  const num = parseInt(col, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return (usePound ? '#' : '') + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    minHeight: 140,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  gradient: {
    flex: 1,
    padding: 18,
    paddingRight: 28,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    position: 'relative',
  },
  borderAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderLeftWidth: 4,
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 24,
    marginRight: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    flex: 1,
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  subtext: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
  // Metric Card
  metricCardContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 160,
  },
  metricCardPressed: {
    opacity: 0.9,
  },
  metricGradient: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#525252',
    flex: 1,
    flexWrap: 'wrap',
  },
  metricIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  metricBody: {
    marginBottom: 14,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    minWidth: 35,
  },
  // Action Card
  actionCardContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 12,
  },
  actionGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
