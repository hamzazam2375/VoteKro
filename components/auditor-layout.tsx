import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AuditorSidebar } from './auditor-sidebar';
import { Navbar } from './navbar';

interface AuditorLayoutProps {
  children: React.ReactNode;
  navbarTitle?: string;
  showSidebar?: boolean;
}

export function AuditorLayout({
  children,
  showSidebar = true,
}: AuditorLayoutProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  return (
    <View style={styles.container}>
      <Navbar infoText="Auditor Portal" />
      <View style={styles.mainContent}>
        {!isMobile && showSidebar && <AuditorSidebar />}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
});
