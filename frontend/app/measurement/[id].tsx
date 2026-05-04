import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
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

function ledColor(w: string, colors: any): string {
  const s = (w || '').toLowerCase();
  if (s.includes('red')) return colors.ledRed;
  if (s.includes('blue')) return colors.ledBlue;
  if (s.includes('green')) return colors.ledGreen;
  return colors.primary;
}

// Returns e.g. "535 nm (Green)" from wavelength string
function wavelengthLabel(w: string): string {
  const s = (w || '').toLowerCase();
  if (s.includes('red')) return '635 nm (Red)';
  if (s.includes('green')) return '535 nm (Green)';
  if (s.includes('blue')) return '470 nm (Blue)';
  return w;
}

export default function MeasurementDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { measurements, calibrations, settings, deleteMeasurement } = useStore();
  const m = measurements.find((x) => x.id === id);
  const [mode, setMode] = useState<'absorbance' | 'concentration'>('absorbance');
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportModal, setExportModal] = useState<{ title: string; body: string } | null>(null);
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
  const unit = settings.unit.replace('mg/L', 'mg/l').replace('MG/L', 'mg/l');

  const absData = m.points.map((p) => ({ x: p.t, y: p.absorbance }));
  const conData = cal != null
    ? m.points.map((p) => ({ x: p.t, y: invert(cal, p.absorbance) ?? 0 }))
    : absData;

  const exportCSV = async () => {
    // CSV changes:
    // - Remove Mean A and Mean I from meta header
    // - Remove separate Concentration line from meta
    // - Add concentration as a column in the data table next to absorbance
    // - Wavelength shows "635 nm (Red)" format
    const header = 'time_s,intensity,absorbance,concentration\n';
    const rows = m.points.map((p) => {
      const conc = cal ? (invert(cal, p.absorbance) ?? '') : '';
      return `${p.t.toFixed(3)},${p.intensity.toFixed(2)},${p.absorbance.toFixed(5)},${conc !== '' ? Number(conc).toFixed(3) : ''}`;
    }).join('\n');
    const meta = [
      `# AquaSpec Measurement Report`,
      `# Sample ID: ${m.sampleId}`,
      `# Date: ${m.createdAt}`,
      `# Contaminant: ${m.contaminant}`,
      `# Wavelength: ${wavelengthLabel(m.wavelength)}`,
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
        setExportModal({ title: 'Saved', body: path });
      }
    } catch (e: any) {
      setExportModal({ title: 'Export Failed', body: e?.message || String(e) });
    }
  };

  const exportPNG = async () => {
    try {
      if (!shotRef.current || !shotRef.current.capture) {
        setExportModal({ title: 'Not Supported', body: 'PNG export requires a native build.' });
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
        setExportModal({ title: 'Saved', body: uri });
      }
    } catch (e: any) {
      setExportModal({ title: 'Export Failed', body: e?.message || String(e) });
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
              m.status === 'safe' ? colors.safe
              : m.status === 'warning' ? colors.warning
              : m.status === 'critical' ? colors.critical
              : colors.textSecondary
            }
          />
          {/* Wavelength badge in its LED colour, showing nm + color name */}
          <Badge label={wavelengthLabel(m.wavelength)} color={ledColor(m.wavelength, colors)} />
        </View>

        {/* Results card — 3 metric boxes REMOVED, show key values as clean rows instead */}
        <Card style={{ marginTop: spacing.md }}>
          <Label>Results</Label>
          <View style={{ marginTop: 10, gap: 8 }}>
            <ResultRow label="Absorbance (OD)" value={m.meanAbsorbance.toFixed(4)} />
            {m.concentration != null && (
              <ResultRow label={`Concentration`} value={`${m.concentration.toFixed(2)} ${unit}`} highlight />
            )}
            <ResultRow label="Intensity" value={m.meanIntensity.toFixed(0)} />
            <ResultRow label="Duration" value={`${m.points[m.points.length - 1]?.t.toFixed(1) ?? '—'} sec`} />
          </View>
        </Card>

        {/* Graph */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Graph</Label>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ChipBtn active={mode === 'absorbance'} label="Absorbance" onPress={() => setMode('absorbance')} testID="graph-mode-abs" />
              <ChipBtn active={mode === 'concentration'} label="Concentration" onPress={() => setMode('concentration')} testID="graph-mode-conc" />
            </View>
          </View>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={{ backgroundColor: colors.surface, marginTop: 10, padding: spacing.md }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{m.sampleId}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                {mode === 'absorbance' ? 'Absorbance vs Time' : `Concentration vs Time (${unit})`}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              {/* Undo #8: restore original simple axis labels, but lowercase mg/l */}
              <Chart
                testID="detail-chart"
                width={screenW}
                height={200}
                data={mode === 'absorbance' ? absData : conData}
                strokeColor={ledColor(m.wavelength, colors)}
                xLabel="t (s)"
                yLabel={mode === 'absorbance' ? 'A' : unit}
              />
            </View>
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
            style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center' }}
          >
            <MaterialCommunityIcons name="file-delimited-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 4 }}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-png-btn"
            onPress={exportPNG}
            style={{ flex: 1, paddingVertical: 14, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, alignItems: 'center' }}
          >
            <MaterialCommunityIcons name="image-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Share PNG</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="delete-measurement-btn"
          onPress={() => setDeleteModal(true)}
          style={{ marginTop: spacing.md, padding: 14, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.critical }}
        >
          <Text style={{ color: colors.critical, fontWeight: '700' }}>Delete Measurement</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Styled delete confirmation modal */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, width: '100%', maxWidth: 340 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>Delete Measurement?</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: spacing.lg }}>
              "{m.sampleId}" will be permanently removed.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setDeleteModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { setDeleteModal(false); await deleteMeasurement(m.id); router.back(); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.critical, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export info/error modal */}
      <Modal visible={!!exportModal} transparent animationType="fade" onRequestClose={() => setExportModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, width: '100%', maxWidth: 340 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>{exportModal?.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>{exportModal?.body}</Text>
            <TouchableOpacity
              onPress={() => setExportModal(null)}
              style={{ paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ color: highlight ? colors.primary : colors.textPrimary, fontFamily: 'monospace', fontSize: 15, fontWeight: highlight ? '700' : '400' }}>
        {value}
      </Text>
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
