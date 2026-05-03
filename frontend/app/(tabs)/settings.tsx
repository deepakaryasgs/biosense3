import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, TextInput, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useStore } from '../../src/store';
import { Card, Label, Title, Sub } from '../../src/components';
import { spacing, radius } from '../../src/theme';

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { settings, updateSettings } = useStore();
  const [aboutVisible, setAboutVisible] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>

        <Card style={{ marginTop: spacing.md }} testID="appearance-card">
          <Label>Appearance</Label>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
            {(['dark', 'light'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`theme-${m}`}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: mode === m ? colors.primary : colors.border,
                  backgroundColor: mode === m ? colors.primary : 'transparent',
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: mode === m ? '#fff' : colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }} testID="thresholds-card">
          {/* Change #3: mg/L → mg/l in placeholder */}
          <Label>Thresholds ({settings.unit.replace('mg/L', 'mg/l').replace('MG/L', 'mg/l')})</Label>
          <Sub style={{ marginTop: 4 }}>
            Safe if ≤ Safe max; Warning if ≤ Warning max; Critical otherwise.
          </Sub>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                testID="safe-max"
                value={String(settings.safeMax)}
                onChangeText={(v) => updateSettings({ safeMax: Number(v) || 0 })}
                keyboardType="numeric"
                placeholder="Safe max"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                testID="warn-max"
                value={String(settings.warningMax)}
                onChangeText={(v) => updateSettings({ warningMax: Number(v) || 0 })}
                keyboardType="numeric"
                placeholder="Warning max"
              />
            </View>
          </View>
          <Input testID="unit-input" value={settings.unit} onChangeText={(v) => updateSettings({ unit: v })} placeholder="Unit (e.g. mg/l)" />
        </Card>

        <Card style={{ marginTop: spacing.md }} testID="blank-card">
          <Label>Optical Reference</Label>
          <Input
            testID="blank-intensity-input"
            value={String(settings.blankIntensity)}
            onChangeText={(v) => updateSettings({ blankIntensity: Number(v) || 0 })}
            keyboardType="numeric"
            placeholder="Blank I₀"
          />
          <Sub style={{ marginTop: 4 }}>I₀ is the transmitted light through a blank cuvette. Used for A = log₁₀(I₀/I).</Sub>
        </Card>

        {/* Change #7 & #10: Styled About button that opens an in-app modal */}
        <TouchableOpacity
          testID="about-btn"
          onPress={() => setAboutVisible(true)}
          style={{
            marginTop: spacing.lg,
            padding: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '600', letterSpacing: 1 }}>ABOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change #10: Styled in-app About modal matching the app's interface */}
      <Modal
        visible={aboutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg ?? 16,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 360,
            alignItems: 'center',
          }}>
            {/* Icon + name */}
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}>
              <MaterialCommunityIcons name="water-opacity" size={38} color={colors.primary} />
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>
              Aqua<Text style={{ color: colors.primary }}>Spec</Text>
            </Text>

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              Portable water-quality biosensor
            </Text>

            <View style={{
              marginTop: spacing.md,
              paddingVertical: 8,
              paddingHorizontal: 16,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>
                IIT ROORKEE
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setAboutVisible(false)}
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 40,
                borderRadius: radius.pill,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Input({ value, onChangeText, placeholder, testID, keyboardType }: any) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      keyboardType={keyboardType}
      style={{
        marginTop: 10,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.textPrimary,
        minHeight: 44,
      }}
    />
  );
}
