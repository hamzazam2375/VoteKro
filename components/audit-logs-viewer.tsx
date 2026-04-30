import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { AuditLogRow } from '@/class/database-types';

/**
 * Audit Logs Viewer Component
 * Displays system logs including admin actions, votes, and system events
 * Provides filtering, searching, and sorting capabilities
 */

interface AuditLogsViewerProps {
  logs: (AuditLogRow & { displayType: string })[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface FilterState {
  type: string | null;
  searchText: string;
  startDate: string;
  endDate: string;
}

export const AuditLogsViewer: React.FC<AuditLogsViewerProps> = ({
  logs,
  isLoading = false,
  onRefresh,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const [filters, setFilters] = useState<FilterState>({
    type: null,
    searchText: '',
    startDate: '',
    endDate: '',
  });
  const [filteredLogs, setFilteredLogs] = useState(logs);
  const [showFilters, setShowFilters] = useState(false);

  // Update filtered logs when logs or filters change
  useEffect(() => {
    filterAndSortLogs();
  }, [logs, filters]);

  const filterAndSortLogs = () => {
    let result = logs;

    // Filter by type
    if (filters.type) {
      result = result.filter((log) => log.displayType === filters.type);
    }

    // Filter by search text
    if (filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase();
      result = result.filter((log) => {
        const actionLower = log.action.toLowerCase();
        const metadataStr = JSON.stringify(log.metadata).toLowerCase();
        return actionLower.includes(searchLower) || metadataStr.includes(searchLower);
      });
    }

    // Filter by date range
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      result = result.filter((log) => new Date(log.created_at).getTime() >= startTime);
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime() + 86400000;
      result = result.filter((log) => new Date(log.created_at).getTime() <= endTime);
    }

    // Already sorted by descending timestamp from service
    setFilteredLogs(result);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'ADMIN_ACTION':
        return '#1a73e8'; // Blue
      case 'VOTE':
        return '#34a853'; // Green
      case 'SYSTEM':
        return '#9aa0a6'; // Gray
      default:
        return '#5f6368';
    }
  };

  const getTypeBackgroundColor = (type: string): string => {
    switch (type) {
      case 'ADMIN_ACTION':
        return '#e3f2fd'; // Light Blue
      case 'VOTE':
        return '#e6f4ea'; // Light Green
      case 'SYSTEM':
        return '#f1f3f4'; // Light Gray
      default:
        return '#f8f9fa';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${hours}:${minutes} (${day}/${month}/${year})`;
    } catch (e) {
      return timestamp;
    }
  };

  const renderLogEntry = (log: AuditLogRow & { displayType: string }) => {
    const bgColor = getTypeBackgroundColor(log.displayType);
    const typeColor = getTypeColor(log.displayType);

    return (
      <View key={log.id} style={[styles.logEntry, { backgroundColor: bgColor }]}>
        <View style={styles.logRow}>
          {/* Type Badge */}
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: typeColor,
              },
            ]}
          >
            <Text style={styles.typeBadgeText}>{log.displayType}</Text>
          </View>

          {/* Log Content */}
          <View style={styles.logContent}>
            <Text style={styles.logAction}>{log.action}</Text>
            <View style={styles.logFooter}>
              <Text style={styles.logTime}>{formatTimestamp(log.created_at)}</Text>
              {log.actor_id && (
                <Text style={styles.logActor}>By: {log.actor_id.substring(0, 8)}...</Text>
              )}
            </View>
          </View>
        </View>

        {/* Metadata (if present) */}
        {Object.keys(log.metadata).length > 0 && (
          <View style={styles.metadata}>
            <Text style={styles.metadataLabel}>Details:</Text>
            <Text style={styles.metadataContent}>{JSON.stringify(log.metadata, null, 2)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFilterPanel = () => (
    <View style={styles.filterPanel}>
      <Text style={styles.filterTitle}>Filters</Text>

      {/* Type Filter */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Log Type</Text>
        <View style={styles.typeFilterButtons}>
          {['ADMIN_ACTION', 'VOTE', 'SYSTEM'].map((type) => (
            <Pressable
              key={type}
              style={[
                styles.typeFilterBtn,
                filters.type === type && styles.typeFilterBtnActive,
                { borderColor: getTypeColor(type) },
              ]}
              onPress={() =>
                setFilters({
                  ...filters,
                  type: filters.type === type ? null : type,
                })
              }
            >
              <Text
                style={[
                  styles.typeFilterBtnText,
                  filters.type === type && { color: getTypeColor(type), fontWeight: '600' },
                ]}
              >
                {type === 'ADMIN_ACTION' ? 'Admin' : type === 'VOTE' ? 'Vote' : 'System'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search Filter */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Search Keyword</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search in logs..."
          value={filters.searchText}
          onChangeText={(text) => setFilters({ ...filters, searchText: text })}
          placeholderTextColor="#999"
        />
      </View>

      {/* Date Range Filters */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Start Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.dateInput}
          placeholder="2026-04-28"
          value={filters.startDate}
          onChangeText={(text) => setFilters({ ...filters, startDate: text })}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>End Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.dateInput}
          placeholder="2026-04-28"
          value={filters.endDate}
          onChangeText={(text) => setFilters({ ...filters, endDate: text })}
          placeholderTextColor="#999"
        />
      </View>

      {/* Clear Filters Button */}
      <Pressable
        style={styles.clearFiltersBtn}
        onPress={() =>
          setFilters({
            type: null,
            searchText: '',
            startDate: '',
            endDate: '',
          })
        }
      >
        <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading audit logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#e3f2fd', '#bbdefb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Audit Logs</Text>
            <Text style={styles.headerSubtitle}>
              {filteredLogs.length} of {logs.length} entries
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.headerBtnText}>
                {showFilters ? 'Hide' : 'Show'} Filters
              </Text>
            </Pressable>
            {onRefresh && (
              <Pressable style={styles.headerBtn} onPress={onRefresh}>
                <Text style={styles.headerBtnText}>Refresh</Text>
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Filter Panel */}
      {showFilters && renderFilterPanel()}

      {/* Logs List */}
      <ScrollView
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}
        showsVerticalScrollIndicator={true}
      >
        {filteredLogs.length > 0 ? (
          <View>
            {filteredLogs.map((log) => renderLogEntry(log))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No logs found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#5f6368',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a73e8',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#5f6368',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    backgroundColor: '#1a73e8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  headerBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  filterPanel: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 12,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3c4043',
    marginBottom: 8,
  },
  typeFilterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  typeFilterBtnActive: {
    backgroundColor: '#f0f4ff',
  },
  typeFilterBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5f6368',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#202124',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#202124',
  },
  clearFiltersBtn: {
    backgroundColor: '#e8eaed',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  clearFiltersBtnText: {
    color: '#202124',
    fontWeight: '600',
    fontSize: 13,
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  logEntry: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1a73e8',
  },
  logRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  typeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 2,
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  logContent: {
    flex: 1,
  },
  logAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#202124',
    marginBottom: 6,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTime: {
    fontSize: 12,
    color: '#5f6368',
  },
  logActor: {
    fontSize: 12,
    color: '#5f6368',
    fontWeight: '500',
  },
  metadata: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dadce0',
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5f6368',
    marginBottom: 6,
  },
  metadataContent: {
    fontSize: 11,
    color: '#5f6368',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier New',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#5f6368',
  },
});
