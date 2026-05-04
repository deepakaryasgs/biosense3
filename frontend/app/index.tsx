import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useStore } from '../../src/store';
import { bleService } from '../../src/ble';
import { Card, Label, Sub, Badge, Body } from '../../src/components';
import { spacing, radius } from '../../src/theme';

export default function Dashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { measurements, calibrations, activeCalibrationId } = useStore();
  const [, force] = useState(0);
  // #3: track disconnect event separately so we can show banner + modal
  const [justDisconnected, setJustDisconnected] = useState(false);
  const [disconnectModal, setDisconnectModal] = useState(false);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // #3: listen for BLE disconnect — show modal popup + banner in device card
  useEffect(() => {
    const unsub = bleService.onDisconnect?.(() => {
      setJustDisconnected(true);
      setDisconnectModal(true);
    });
    return () => unsub?.();
  }, []);

  const connected = bleService.getConnected();
  // Once reconnected, clear the disconnect banner
  useEffect(() => {
    if (connected) setJustDisconnected(false);
  }, [connected]);

  const activeCal = calibrations.find((c) => c.id === activeCalibrationId);
  const battery = connected ? bleService.getBatteryLevel() : 0;

  const recent = measurements.slice(0, 3);
  const statusCounts = {
    safe: measurements.filter((m) => m.status === 'safe').length,
    warning: measurements.filter((m) => m.status === 'warning').length,
    critical: measurements.filter((m) => m.status === 'critical').length,
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} testID="dashboard-scroll">

        {/* Device card */}
        <Card testID="device-card" style={{
          marginBottom: spacing.md,
          marginTop: 0,
          borderColor: justDisconnected ? colors.warning : colors.border,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Label>Device</Label>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600', marginTop: 4 }}>
                {connected ? connected.name : justDisconnected ? 'Disconnected' : 'Not connected'}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: 8, flexWrap: 'wrap' }}>
                <Badge
                  label={connected ? 'Connected' : justDisconnected ? 'Disconnected' : 'Offline'}
                  color={connected ? colors.safe : justDisconnected ? colors.warning : colors.textSecondary}
                  testID="connection-status-badge"
                />
              </View>
              {/* #3: inline warning message when device drops */}
              {justDisconnected && !connected && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <MaterialCommunityIcons name="bluetooth-off" size={14} color={colors.warning} />
                  <Text style={{ color: colors.warning, fontSize: 12 }}>
                    Device disconnected unexpectedly
                  </Text>
                </View>
              )}
            </View>
            <MaterialCommunityIcons
              name={connected ? 'bluetooth-connect' : justDisconnected ? 'bluetooth-off' : 'bluetooth-off'}
              size={36}
              color={connected ? colors.primary : justDisconnected ? colors.warning : colors.textSecondary}
            />
          </View>

          {connected && (
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="battery-70" size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, marginLeft: 6, fontSize: 13 }}>
                Battery {battery}%
              </Text>
            </View>
          )}

          <TouchableOpacity
            testID="open-connect-btn"
            onPress={() => router.push('/connect')}
            style={{
              marginTop: spacing.md,
              backgroundColor: justDisconnected && !connected ? colors.warning : colors.primary,
              paddingVertical: 12,
              borderRadius: radius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 0.5 }}>
              {connected ? 'Manage Device' : justDisconnected ? 'Reconnect Device' : 'Connect Device'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
          <StatBox value={measurements.length} label="Samples" color={colors.primary} />
          <StatBox value={statusCounts.safe} label="Safe" color={colors.safe} />
          <StatBox value={statusCounts.warning} label="Warning" color={colors.warning} />
          <StatBox value={statusCounts.critical} label="Critical" color={colors.critical} />
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
          <ActionTile
            testID="dash-measure-btn"
            onPress={() => router.push('/(tabs)/measure')}
            icon="test-tube"
            label="New Measurement"
          />
          <ActionTile
            testID="dash-calibrate-btn"
            onPress={() => router.push('/(tabs)/calibrate')}
            icon="tune-vertical"
            label="Calibration"
          />
        </View>

        {/* Active calibration */}
        <Card style={{ marginBottom: spacing.md }} testID="active-cal-card">
          <Label>Active Calibration</Label>
          {activeCal ? (
            <>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                {activeCal.name}
              </Text>
              <Sub style={{ marginTop: 2 }}>{activeCal.contaminant} · {activeCal.unit}</Sub>
              <Text style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginTop: 6 }}>
                {activeCal.equation}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>R² = {activeCal.r2.toFixed(4)}</Text>
            </>
          ) : (
            <Body style={{ marginTop: 6, color: colors.textSecondary }}>
              No calibration selected. Create one in the Calibrate tab to compute concentrations.
            </Body>
          )}
        </Card>

        {/* Recent measurements */}
        <Label style={{ marginBottom: spacing.sm }}>Recent Measurements</Label>
        {recent.length === 0 && (
          <Card testID="empty-recent">
            <Body style={{ color: colors.textSecondary }}>No measurements yet. Start your first run from Measure.</Body>
          </Card>
        )}
        {recent.map((m) => (
          <TouchableOpacity
            key={m.id}
            testID={`recent-${m.id}`}
            onPress={() => router.push(`/measurement/${m.id}`)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{m.sampleId}</Text>
                <Sub style={{ marginTop: 2 }}>
                  {new Date(m.createdAt).toLocaleString()} · {m.contaminant}
                </Sub>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: 'monospace', fontSize: 16 }}>
                  {m.meanAbsorbance.toFixed(3)} A
                </Text>
                {m.concentration != null && (
                  <Text style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginTop: 2 }}>
                    {m.concentration.toFixed(2)} mg/l
                  </Text>
                )}
                <Badge
                  label={m.status}
                  color={
                    m.status === 'safe' ? colors.safe
                    : m.status === 'warning' ? colors.warning
                    : m.status === 'critical' ? colors.critical
                    : colors.textSecondary
                  }
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* #3: Disconnect popup modal — styled to match app interface */}
      <Modal visible={disconnectModal} transparent animationType="fade" onRequestClose={() => setDisconnectModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.warning,
            borderRadius: 16,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 340,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <MaterialCommunityIcons name="bluetooth-off" size={22} color={colors.warning} />
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17 }}>
                Device Disconnected
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
              Your BLE device was disconnected unexpectedly. Please reconnect to continue measuring.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setDisconnectModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setDisconnectModal(false); router.push('/connect'); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.warning, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Reconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: 6,
      alignItems: 'center',
    }}>
      <Text style={{ color, fontSize: 22, fontWeight: '700', fontFamily: 'monospace' }}>{value}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

function ActionTile({ icon, label, onPress, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        minHeight: 80,
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
      <Text style={{ color: colors.textPrimary, fontWeight: '600', marginTop: 8, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}
