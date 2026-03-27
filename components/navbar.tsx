import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NavbarAction = {
    label: string;
    onPress: () => void;
    variant?: 'solid' | 'outline';
};

type NavbarProps = {
    actions?: NavbarAction[];
    infoText?: string;
    compact?: boolean;
};

export function Navbar({ actions = [], infoText, compact = false }: NavbarProps) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 760;
    const insets = useSafeAreaInsets();

    const handleBrandPress = () => {
        router.replace('/');
    };

    return (
        <View
            style={[
                styles.navbar,
                compact && styles.navbarCompact,
                { paddingTop: insets.top + (compact ? 8 : 10) },
            ]}
        >
            {/* Top row: brand on left, action buttons on right */}
            <View style={[styles.topRow, compact && styles.topRowCompact]}>
                <Pressable
                    style={({ pressed }) => [styles.brandWrap, pressed && styles.brandWrapPressed]}
                    onPress={handleBrandPress}
                >
                    <Text style={[styles.brandName, compact && styles.brandNameCompact]}>VoteKro</Text>
                </Pressable>

                <View style={styles.actionsRow}>
                    {/* On desktop, show infoText inline before buttons */}
                    {!!infoText && !isMobile && (
                        <Text style={[styles.infoText, compact && styles.infoTextCompact]}>{infoText}</Text>
                    )}
                    {actions.map((action, index) => {
                        const isSolid = action.variant === 'solid';
                        return (
                            <Pressable
                                key={`${action.label}-${index}`}
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    compact && styles.actionButtonCompact,
                                    isSolid ? styles.actionButtonSolid : styles.actionButtonOutline,
                                    pressed && styles.actionButtonPressed,
                                ]}
                                onPress={action.onPress}
                            >
                                <Text
                                    style={[
                                        styles.actionText,
                                        compact && styles.actionTextCompact,
                                        isSolid ? styles.actionTextSolid : styles.actionTextOutline,
                                    ]}
                                >
                                    {action.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* On mobile, show infoText below the top row as a full-width second line */}
            {!!infoText && isMobile && (
                <Text style={[styles.infoTextMobile, compact && styles.infoTextMobileCompact]}>{infoText}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    navbar: {
        paddingHorizontal: 24,
        paddingBottom: 12,
        backgroundColor: '#f0f2f5',
        borderBottomWidth: 2,
        borderBottomColor: '#2d63ea',
        zIndex: 2,
    },
    navbarCompact: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: '#f6f7fa',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
    },
    topRowCompact: {
        minHeight: 40,
    },
    brandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandWrapPressed: {
        opacity: 0.82,
    },
    brandName: {
        color: '#2c63dd',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    brandNameCompact: {
        fontSize: 30,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#233449',
        fontWeight: '500',
        marginRight: 8,
    },
    infoTextCompact: {
        fontSize: 14,
        color: '#2f64e6',
        marginRight: 8,
    },
    infoTextMobile: {
        fontSize: 13,
        color: '#233449',
        fontWeight: '500',
        marginTop: 4,
        paddingHorizontal: 2,
    },
    infoTextMobileCompact: {
        color: '#2f64e6',
    },
    actionButton: {
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderWidth: 1.5,
    },
    actionButtonCompact: {
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 14,
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
    actionTextCompact: {
        fontSize: 14,
        fontWeight: '700',
    },
    actionTextSolid: {
        color: '#ffffff',
    },
    actionTextOutline: {
        color: '#2e63e3',
    },
});
