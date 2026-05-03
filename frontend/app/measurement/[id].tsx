import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../src/ThemeContext';
import { useStore } from '../../src/store';
import { Card, Label, Title, Sub, Badge } from '../../src/components';
import { Chart } from '../../src/Chart';
import { spacing, radius } from '../../src/theme';

// Change #6: resolve actual LED colour from wavelength string
function ledColor(w: string, colors: any): string {
  const s = (w || '').toLowerCase();
  if (s.includes('red')) return colors.ledRed;
  if (s.includes('blue')) return colors.ledBlue;
  if (s.includes('green')) return colors.ledGreen;
  return colors.primary;
}

export default function MeasurementDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { measurements, calibrations, settings, deleteMeasurement } = useStore();
  const m = measurements.find((x) => x.id === id);
  const [mode, setMode] = useState<'absorbance' | 'concentration'>('absorbance');
  const shotRef = useRef<ViewShot>(null);

  if (!m) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg }}>
          <Sub>Measurement not found.</Sub>
        </View>
      </SafeAreaView>
    );
  }

  const cal = calibrations.find((c) => c.id === m.calibrationId);
  const screenW = Dimensions.get('window').width - spacing.md * 2 - spacing.lg * 2;

  const absData = m.points.map((p) => ({ x: p.t, y: p.absorbance }));
  const conData =
    cal != null
      ? m.points.map((p) => ({ x: p.t, y: invert(cal, p.absorbance) ?? 0 }))
      : absData;

  const exportCSV = async () => {
    const header = 'time_s,intensity,absorbance\n';
    const rows = m.points.map((p) => `${p.t.toFixed(3)},${p.intensity.toFixed(2)},${p.absorbance.toFixed(5)}`).join('\n');
    const meta = [
      `# AquaSpec Measurement Report`,
      `# Sample ID: ${m.sampleId}`,
      `# Date: ${m.createdAt}`,
      `# Contaminant: ${m.contaminant}`,
      `# Wavelength: ${m.wavelength}`,
      `# Mean A: ${m.meanAbsorbance.toFixed(5)}`,
      `# Mean I: ${m.meanIntensity.toFixed(2)}`,
      `# Concentration: ${m.concentration != null ? `${m.concentration.toFixed(3)} ${settings.unit}` : 'N/A'}`,
      `# Status: ${m.status}`,
      `# Calibration: ${cal ? `${cal.name} (${cal.equation}, R²=${cal.r2.toFixed(4)})` : 'None'}`,
      `# Notes: ${m.notes.replace(/\n/g, ' ')}`,
      '',
    ].join('\n');
    const content = meta + header + rows;
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${m.sampleId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const path = `${FileSystem.cacheDirectory}${m.sampleId}-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Share CSV' });
      } else {
        Alert.alert('Saved', path);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || String(e));
    }
  };

  const exportPNG = async () => {
    try {
      if (!shotRef.current || !shotRef.current.capture) {
        Alert.alert('Not supported', 'PNG export requires a native build.');
        return;
      }
      const uri = await shotRef.current.capture();
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `${m.sampleId}.png`;
        a.click();
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share graph' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || String(e));
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <Title>{m.sampleId}</Title>
        <Sub style={{ marginTop: 4 }}>{new Date(m.createdAt).toLocaleString()}</Sub>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <Badge
            label={m.status}
            color={
              m.status === 'safe'
                ? colors.safe
                : m.status === 'warning'
                ? colors.warning
                : m.status === 'critical'
                ? colors.critical
                : colors.textSecondary
            }
          />
          {/* Change #6: Wavelength badge shown in its actual LED colour */}
          <Badge label={m.wavelength} color={ledColor(m.wavelength, colors)} />
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <Label>Results</Label>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Metric testID="metric-mean-absorbance" label="Mean A" value={m.meanAbsorbance.toFixed(3)} />
            <Metric testID="metric-mean-intensity" label="Mean I" value={m.meanIntensity.toFixed(0)} />
            <Metric
              testID="metric-concentration"
              label={`Conc (${settings.unit})`}
              value={m.concentration != null ? m.concentration.toFixed(2) : '—'}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Graph</Label>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ChipBtn active={mode === 'absorbance'} label="Absorbance" onPress={() => setMode('absorbance')} testID="graph-mode-abs" />
              <ChipBtn
                active={mode === 'concentration'}
                label="Concentration"
                onPress={() => setMode('concentration')}
                testID="graph-mode-conc"
              />
            </View>
          </View>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={{ backgroundColor: colors.surface, marginTop: 10, padding: spacing.md }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{m.sampleId}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                {mode === 'absorbance' ? 'Absorbance vs Time' : `Concentration vs Time`}
              </Text>
            </View>
            {/* Change #8: Y-axis label vertical centered, X-axis label centered below */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Vertical Y-axis label */}
              <View style={{ width: 20, height: 200, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{
                  color: colors.textSecondary,
                  fontSize: 10,
                  letterSpacing: 0.5,
                  transform: [{ rotate: '-90deg' }],
                  width: 160,
                  textAlign: 'center',
                }}>
                  {mode === 'absorbance' ? 'Absorbance (OD)' : `Concentration (${settings.unit.replace('mg/L','mg/l').replace('MG/L','mg/l')})`}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Chart
                  testID="detail-chart"
                  width={screenW - 20}
                  height={200}
                  data={mode === 'absorbance' ? absData : conData}
                  strokeColor={ledColor(m.wavelength, colors)}
                  xLabel=""
                  yLabel=""
                />
              </View>
            </View>
            {/* X-axis label centered */}
            <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 0.5, textAlign: 'center', marginTop: 4 }}>
              Time (sec)
            </Text>
          </ViewShot>
        </Card>

        {cal && (
          <Card style={{ marginTop: spacing.md }}>
            <Label>Calibration</Label>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 4 }}>{cal.name}</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>{cal.equation}</Text>
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>R² = {cal.r2.toFixed(4)}</Text>
          </Card>
        )}

        {m.notes ? (
          <Card style={{ marginTop: spacing.md }}>
            <Label>Notes</Label>
            <Text style={{ color: colors.textPrimary, marginTop: 6 }}>{m.notes}</Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <TouchableOpacity
            testID="export-csv-btn"
            onPress={exportCSV}
            style={{
              flex: 1,
              paddingVertical: 14,
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons name="file-delimited-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 4 }}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-png-btn"
            onPress={exportPNG}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: radius.md,
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons name="image-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Share PNG</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="delete-measurement-btn"
          onPress={() =>
            Alert.alert('Delete?', m.sampleId, [
              { text: 'Cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteMeasurement(m.id);
                  router.back();
                },
              },
            ])
          }
          style={{
            marginTop: spacing.md,
            padding: 14,
            borderRadius: radius.md,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.critical,
          }}
        >
          <Text style={{ color: colors.critical, fontWeight: '700' }}>Delete Measurement</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function invert(cal: any, absorbance: number): number | null {
  if (cal.modelType === 'linear' || cal.degree === 1) {
    const [a, b] = cal.coefficients;
    if (b === 0) return null;
    return (absorbance - a) / b;
  }
  const xs = (cal.standards as { concentration: number }[]).map((s) => s.concentration);
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  if (lo === hi) return lo;
  const span = hi - lo;
  lo -= span;
  hi += span;
  const f = (x: number) => cal.coefficients.reduce((s: number, c: number, i: number) => s + c * Math.pow(x, i), 0);
  const monotonic = f(hi) >= f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (monotonic) {
      if (v < absorbance) lo = mid;
      else hi = mid;
    } else {
      if (v > absorbance) lo = mid;
      else hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function Metric({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surfaceElevated,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontFamily: 'monospace', fontSize: 18, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function ChipBtn({ active, label, onPress, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}
