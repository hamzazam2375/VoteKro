import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type PasswordFieldProps = {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    placeholderTextColor?: string;
    editable?: boolean;
};

export function PasswordField({
    label,
    value,
    onChangeText,
    placeholder,
    placeholderTextColor = '#999',
    editable = true,
}: PasswordFieldProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrap}>
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderTextColor}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!isVisible}
                    editable={editable}
                />
                <Pressable
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.toggleButtonPressed]}
                    onPress={() => setIsVisible((current) => !current)}
                    disabled={!editable}
                >
                    <Ionicons
                        name={isVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#6b7a90"
                    />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f1f3f',
        marginBottom: 7,
    },
    inputWrap: {
        position: 'relative',
        justifyContent: 'center',
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#c7d2e2',
        borderRadius: 10,
        paddingLeft: 14,
        paddingRight: 44,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1a2438',
    },
    toggleButton: {
        position: 'absolute',
        right: 12,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toggleButtonPressed: {
        opacity: 0.75,
    },
});
