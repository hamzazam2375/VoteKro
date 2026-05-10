import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar, type DashboardHomeRoute, type NavbarAction } from './navbar';

export type DashboardSidebarItem = {
    key: string;
    label: string;
    icon: string;
    onPress: () => void;
    active?: boolean;
};

type DashboardUserDetails = {
    email?: string;
};

type DashboardShellProps = {
    sidebarItems: DashboardSidebarItem[];
    userName: string;
    userRole: string;
    userDetails?: DashboardUserDetails;
    infoText?: string;
    onLogout: () => void;
    children: ReactNode;
    actions?: NavbarAction[];
    compactNavbar?: boolean;
    homeRoute?: DashboardHomeRoute;
};

export function DashboardShell({
    sidebarItems,
    userName,
    userRole,
    userDetails,
    infoText,
    onLogout,
    children,
    actions,
    compactNavbar = false,
    homeRoute = '/',
}: DashboardShellProps) {
    const { width } = useWindowDimensions();
    const isMobile = width < 600;
    const insets = useSafeAreaInsets();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showUserDetails, setShowUserDetails] = useState(false);
    const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (hoverCloseTimerRef.current) {
                clearTimeout(hoverCloseTimerRef.current);
            }
        };
    }, []);

    const openUserDetails = () => {
        if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current);
            hoverCloseTimerRef.current = null;
        }
        setShowUserDetails(true);
    };

    const closeUserDetails = () => {
        if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current);
        }

        hoverCloseTimerRef.current = setTimeout(() => {
            setShowUserDetails(false);
            hoverCloseTimerRef.current = null;
        }, 120);
    };

    const handleItemPress = (onPress: () => void) => {
        onPress();
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    const router = useRouter();
    const handleLogoPress = () => {
        router.replace('/');
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
                    <Pressable style={styles.mobileLogo} onPress={handleLogoPress}>
    <Text style={styles.mobileLogoText}>VoteKro</Text>
</Pressable>
                    <Pressable style={styles.mobileLogoutButton} onPress={onLogout}>
                        <Text style={styles.mobileLogoutText}>Logout</Text>
                    </Pressable>
                </View>
            ) : (
                <Navbar
                    compact={compactNavbar}
                    infoText={infoText}
                    homeRoute={homeRoute}
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
                            <Pressable
                                style={({ pressed }) => [styles.userProfileCard, pressed && styles.userProfileCardPressed]}
                                accessibilityRole="button"
                                onHoverIn={openUserDetails}
                                onHoverOut={closeUserDetails}
                                onPress={() => {
                                    if (Platform.OS !== 'web') {
                                        setShowUserDetails((previous) => !previous);
                                    }
                                }}
                            >
                                <Text numberOfLines={1} style={styles.userProfileName}>{userName}</Text>
                                <Text style={styles.userProfileRole}>{userRole}</Text>
                            </Pressable>

                            {showUserDetails ? (
                                <Pressable
                                    style={styles.userDetailsTooltip}
                                    onHoverIn={openUserDetails}
                                    onHoverOut={closeUserDetails}
                                >
                                    <Text style={styles.userDetailsTitle}>Login Details</Text>
                                    <Text style={styles.userDetailsText}>Email: {userDetails?.email ?? 'N/A'}</Text>
                                    <Text style={styles.userDetailsText}>Password: Not available for security</Text>
                                </Pressable>
                            ) : null}
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
        padding: 8,
        marginRight: 12,
    },
    mobileLogoText: {
        fontSize: 24,
        fontWeight: '700',
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
        justifyContent: 'flex-start',
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
        boxShadow: '2px 0px 8px rgba(0, 0, 0, 0.2)',
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
    sidebarFooter: {
        position: 'relative',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#edf0f5',
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
    userProfileCard: {
        backgroundColor: '#f6f8fc',
        borderWidth: 1,
        borderColor: '#e1e7f2',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    userProfileCardPressed: {
        opacity: 0.95,
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
    userDetailsTooltip: {
        marginTop: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dce5f1',
        borderRadius: 10,
        padding: 10,
        boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.12)',
        elevation: 6,
    },
    userDetailsTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1f2e4a',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    userDetailsText: {
        fontSize: 12,
        color: '#41536f',
        lineHeight: 18,
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
});