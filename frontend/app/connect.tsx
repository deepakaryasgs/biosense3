import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { useStore } from '../src/store';
import { bleService, BleDevice } from '../src/ble';
import { Card, Label, Sub, Badge } from '../src/components';
import { spacing, radius } from '../src/theme';

export default function Connect() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings } = useStore();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<BleDevice | null>(bleService.getConnected());
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

  // Change #3: listen for disconnect and clear connected state
  useEffect(() => {
    const unsub = bleService.onDisconnect?.(() => {
      setConnected(null);
      setModal({
        title: 'Device Disconnected',
        body: 'The BLE device was disconnected. Tap "Scan for Devices" to reconnect.',
      });
    });
    return () => unsub?.();
  }, []);

  const startScan = async () => {
    setScanning(true);
    setDevices([]);
    try {
      await bleService.scan((d) => {
        // Change #6: filter out demo/simulated devices
        if (d.isDemo) return;
        setDevices((prev) => (prev.find((x) => x.id === d.id) ? prev : [...prev, d]));
      });
    } catch (e: any) {
      // Change #9: styled modal instead of Alert
      setModal({ title: 'Scan Error', body: e?.message || String(e) });
    } finally {
      setScanning(false);
    }
  };

  const connect = async (d: BleDevice) => {
    setConnecting(d.id);
    try {
      await bleService.connect(d);
      setConnected(bleService.getConnected());
      // Change #9: styled modal instead of Alert
      setModal({ title: 'Connected', body: `${d.name} is ready. You can now start measuring.` });
    } catch (e: any) {
      setModal({ title: 'Connection Failed', body: e?.message || String(e) });
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async () => {
    await bleService.disconnect();
    setConnected(null);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>

        {/* Change #6: Demo Mode card completely removed */}

        {connected ? (
          <Card testID="connected-card" style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm }}>
              <View style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: colors.safe,
              }} />
              <Label>Connected</Label>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 4 }}>
              {connected.name}
            </Text>
            <Sub style={{ marginTop: 2 }}>{connected.id}</Sub>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: 10 }}>
              <TouchableOpacity
                testID="disconnect-btn"
                onPress={disconnect}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.critical,
                  padding: 12,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.critical, fontWeight: '700' }}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="goto-measure-btn"
                onPress={() => router.replace('/(tabs)/measure')}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Go to Measure</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        <TouchableOpacity
          testID="scan-btn"
          onPress={startScan}
          disabled={scanning}
          style={{
            backgroundColor: colors.primary,
            padding: 14,
            borderRadius: radius.md,
            alignItems: 'center',
            marginBottom: spacing.md,
            opacity: scanning ? 0.6 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {scanning && (
            <MaterialCommunityIcons name="bluetooth-audio" size={18} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>
            {scanning ? 'SCANNING…' : 'SCAN FOR DEVICES'}
          </Text>
        </TouchableOpacity>

        {devices.length === 0 && !scanning && (
          <Card>
            <Sub>No devices found. Tap Scan to discover nearby BLE biosensors.</Sub>
          </Card>
        )}

        {devices.map((d) => (
          <TouchableOpacity
            key={d.id}
            testID={`device-${d.id}`}
            onPress={() => connect(d)}
            disabled={connecting === d.id}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: connecting === d.id ? colors.primary : colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{d.name}</Text>
              <Sub style={{ marginTop: 2 }}>
                {d.id}{d.rssi ? ` · ${d.rssi} dBm` : ''}
              </Sub>
            </View>
            <MaterialCommunityIcons
              name={connecting === d.id ? 'dots-horizontal' : 'chevron-right'}
              size={22}
              color={connecting === d.id ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Change #9: Styled in-app modal for all notifications */}
      <Modal
        visible={!!modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
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
            borderRadius: 16,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 340,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <MaterialCommunityIcons
                name={
                  modal?.title === 'Connected' ? 'bluetooth-connect' :
                  modal?.title === 'Device Disconnected' ? 'bluetooth-off' :
                  'alert-circle-outline'
                }
                size={22}
                color={
                  modal?.title === 'Connected' ? colors.safe :
                  modal?.title === 'Device Disconnected' ? colors.warning :
                  colors.critical
                }
              />
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17 }}>
                {modal?.title}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
              {modal?.body}
            </Text>
            <TouchableOpacity
              onPress={() => setModal(null)}
              style={{
                paddingVertical: 12,
                borderRadius: radius.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
