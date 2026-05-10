import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar, type NavbarAction } from './navbar';

export type DashboardSidebarItem = {
    key: string;
    label: string;
    icon: string;
    onPress: () => void;
    active?: boolean;
};

type DashboardShellProps = {
    sidebarItems: DashboardSidebarItem[];
    userName: string;
    userRole: string;
    infoText?: string;
    onLogout: () => void;
    children: ReactNode;
    actions?: NavbarAction[];
    compactNavbar?: boolean;
};

export function DashboardShell({
    sidebarItems,
    userName,
    userRole,
    infoText,
    onLogout,
    children,
    actions,
    compactNavbar = false,
}: DashboardShellProps) {
    const { width } = useWindowDimensions();
    const isMobile = width < 600;
    const insets = useSafeAreaInsets();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleItemPress = (onPress: () => void) => {
        onPress();
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <View style={styles.container}>
            {isMobile ? (
                <View style={[styles.mobileHeader, { paddingTop: insets.top + 10 }]}>
                    <Pressable
                        style={styles.mobileHamburger}
                        onPress={() => setSidebarOpen((previous) => !previous)}
                    >
                        <Text style={styles.mobileHamburgerIcon}>☰</Text>
                    </Pressable>
                    <Text style={styles.mobileLogo}>VoteKro</Text>
                    <Pressable style={styles.mobileLogoutButton} onPress={onLogout}>
                        <Text style={styles.mobileLogoutText}>Logout</Text>
                    </Pressable>
                </View>
            ) : (
                <Navbar
                    compact={compactNavbar}
                    infoText={infoText}
                    actions={actions ?? [{ label: 'Logout', onPress: onLogout, variant: 'outline' }]}
                />
            )}

            <View style={[styles.mainLayout, isMobile && styles.mainLayoutMobile]}>
                {isMobile && sidebarOpen && (
                    <Pressable
                        style={styles.sidebarOverlay}
                        onPress={() => setSidebarOpen(false)}
                    />
                )}

                {(!isMobile || sidebarOpen) && (
                    <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
                        <View style={styles.sidebarMenu}>
                            {sidebarItems.map((item) => (
                                <Pressable
                                    key={item.key}
                                    style={[
                                        styles.sidebarButton,
                                        item.active && styles.sidebarButtonActive,
                                    ]}
                                    onPress={() => handleItemPress(item.onPress)}
                                >
                                    <Text
                                        style={[
                                            styles.sidebarButtonText,
                                            item.active && styles.sidebarButtonTextActive,
                                        ]}
                                    >
                                        {item.icon} {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        <View style={styles.sidebarFooter}>
                            <View style={styles.welcomeCard}>
                                <Text style={styles.welcomeText}>{userName}</Text>
                                <Text style={styles.welcomeSubtext}>{userRole}</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.content}>{children}</View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        position: 'relative',
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
        position: 'relative',
    },
    mainLayoutMobile: {
        flexDirection: 'column',
    },
    mobileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    mobileHamburger: {
        padding: 8,
        marginRight: 12,
    },
    mobileHamburgerIcon: {
        fontSize: 28,
        color: '#1a73e8',
        fontWeight: '700',
    },
    mobileLogo: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1a73e8',
        flex: 1,
    },
    mobileLogoutButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#1a73e8',
    },
    mobileLogoutText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a73e8',
    },
    sidebar: {
        width: 240,
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#e0e0e0',
        paddingVertical: 20,
        paddingHorizontal: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    sidebarMobile: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 999,
        width: 240,
        maxWidth: '80%',
        height: '100%',
        borderRightWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    sidebarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 500,
    },
    sidebarMenu: {
        gap: 8,
        flex: 1,
    },
    sidebarButton: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    sidebarButtonActive: {
        backgroundColor: '#1a73e8',
    },
    sidebarButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4a4a4a',
    },
    sidebarButtonTextActive: {
        color: '#ffffff',
    },
    sidebarFooter: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    welcomeCard: {
        backgroundColor: '#f0f4ff',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#1a73e8',
    },
    welcomeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a73e8',
        marginBottom: 4,
    },
    welcomeSubtext: {
        fontSize: 12,
        color: '#677b94',
        fontWeight: '500',
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
});