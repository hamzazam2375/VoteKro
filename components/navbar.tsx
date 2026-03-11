import { serviceFactory } from '@/class/service-factory';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export type NavbarAction = {
    label: string;
    onPress: () => void;
    variant?: 'solid' | 'outline';
};

type NavbarProps = {
    actions?: NavbarAction[];
    infoText?: string;
};

export function Navbar({ actions = [], infoText }: NavbarProps) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 760;
    const [isNavigating, setIsNavigating] = useState(false);

    const handleBrandPress = async () => {
        if (isNavigating) {
            return;
        }

        setIsNavigating(true);
        try {
            const profile = await serviceFactory.authService.getCurrentProfile();
            if (profile) {
                if (profile.role === 'voter') {
                    router.replace('/VoterDashboard');
                    return;
                }

                router.replace('/AdminDashboard');
                return;
            }

            router.replace('/');
        } catch {
            router.replace('/');
        } finally {
            setIsNavigating(false);
        }
    };

    return (
        <View style={[styles.navbar, isMobile && styles.navbarMobile]}>
            <Pressable
                style={({ pressed }) => [styles.brandWrap, pressed && styles.brandWrapPressed]}
                onPress={handleBrandPress}
            >
                <Text style={styles.brandIcon}>🗳️</Text>
                <Text style={styles.brandName}>VoteKro</Text>
            </Pressable>

            <View style={[styles.rightWrap, isMobile && styles.rightWrapMobile]}>
                {!!infoText && <Text style={[styles.infoText, isMobile && styles.infoTextMobile]}>{infoText}</Text>}
                {actions.map((action, index) => {
                    const isSolid = action.variant === 'solid';

                    return (
                        <Pressable
                            key={`${action.label}-${index}`}
                            style={({ pressed }) => [
                                styles.actionButton,
                                isSolid ? styles.actionButtonSolid : styles.actionButtonOutline,
                                pressed && styles.actionButtonPressed,
                            ]}
                            onPress={action.onPress}
                        >
                            <Text style={[styles.actionText, isSolid ? styles.actionTextSolid : styles.actionTextOutline]}>
                                {action.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    navbar: {
        minHeight: 72,
        paddingHorizontal: 24,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0f2f5',
        borderBottomWidth: 2,
        borderBottomColor: '#2d63ea',
        zIndex: 2,
    },
    navbarMobile: {
        alignItems: 'flex-start',
        gap: 10,
    },
    brandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandWrapPressed: {
        opacity: 0.82,
    },
    brandIcon: {
        fontSize: 24,
    },
    brandName: {
        color: '#2c63dd',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    rightWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    rightWrapMobile: {
        width: '100%',
        flexWrap: 'wrap',
    },
    infoText: {
        fontSize: 14,
        color: '#233449',
        fontWeight: '500',
        marginRight: 8,
    },
    infoTextMobile: {
        width: '100%',
        marginRight: 0,
    },
    actionButton: {
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderWidth: 1.5,
    },
    actionButtonSolid: {
        backgroundColor: '#2e63e3',
        borderColor: '#2e63e3',
    },
    actionButtonOutline: {
        backgroundColor: 'transparent',
        borderColor: '#2e63e3',
    },
    actionButtonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.98 }],
    },
    actionText: {
        fontSize: 16,
        fontWeight: '700',
    },
    actionTextSolid: {
        color: '#ffffff',
    },
    actionTextOutline: {
        color: '#2e63e3',
    },
});
