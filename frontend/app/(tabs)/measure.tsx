import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { bleService, Sample, Wavelength } from '../../src/ble';
import { useStore, Measurement } from '../../src/store';
import { useRouter } from 'expo-router';
import { Card, Label, Badge, Sub } from '../../src/components';
import { Chart } from '../../src/Chart';
import { spacing, radius } from '../../src/theme';

export default function Measure() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, calibrations, activeCalibrationId, addMeasurement, updateSettings } = useStore();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const [wavelength, setWavelength] = useState<Wavelength>('green');
  const [sampleId, setSampleId] = useState('');
  const [contaminant, setContaminant] = useState('');
  const [notes, setNotes] = useState('');
  const [blankI0, setBlankI0] = useState(String(settings.blankIntensity));
  const [modalMsg, setModalMsg] = useState<{ title: string; body: string; onView?: () => void } | null>(null);
  const samplesRef = useRef<Sample[]>([]);

  const activeCal = calibrations.find((c) => c.id === activeCalibrationId) || null;

  // Only send wavelength to BLE if LED is currently on
  useEffect(() => {
    if (ledOn) {
      bleService.setWavelength(wavelength).catch(() => {});
    }
    // If LED is off, just store the selection silently — don't glow
  }, [wavelength]);

  useEffect(() => {
    bleService.setBlank(settings.blankIntensity);
  }, [settings.blankIntensity]);

  // When LED turns on, activate the currently selected wavelength; when off, turn it off
  useEffect(() => {
    bleService.setLedOn(ledOn).catch(() => {});
    if (ledOn) {
      bleService.setWavelength(wavelength).catch(() => {});
    }
  }, [ledOn]);

  useEffect(() => {
    const unsub = bleService.onData((s) => {
      samplesRef.current = [...samplesRef.current, s].slice(-300);
      setSamples(samplesRef.current);
    });
    return unsub;
  }, []);

  const last = samples[samples.length - 1];
  const intensity = last?.intensity ?? 0;
  const absorbance = last?.absorbance ?? 0;
  const concFromCal = activeCal ? invertCal(activeCal, absorbance) : null;

  const status = threshold(concFromCal, settings.safeMax, settings.warningMax);

  // Change #3: detect BLE disconnect while in use
  useEffect(() => {
    const unsub = bleService.onDisconnect?.(() => {
      setRunning(false);
      setPaused(false);
      setLedOn(false);
      setModalMsg({ title: 'Device Disconnected', body: 'The BLE device was disconnected. Please reconnect to continue.' });
    });
    return () => unsub?.();
  }, []);

  // Change #11: BLE only — no demo mode
  const handleStart = () => {
    if (!bleService.getConnected()) {
      setModalMsg({ title: 'Not Connected', body: 'Connect a BLE device first to start measuring.' });
      return;
    }
    samplesRef.current = [];
    setSamples([]);
    bleService.setBlank(Number(blankI0) || 1000);
    setLedOn(true);
    bleService.setLedOn(true).catch(() => {});
    bleService.setWavelength(wavelength).catch(() => {});
    bleService.start();
    setRunning(true);
    setPaused(false);
  };

  const handlePause = () => {
    if (paused) {
      bleService.resume();
      setPaused(false);
    } else {
      bleService.pause();
      setPaused(true);
    }
  };

  const handleStop = async () => {
    bleService.stop();
    setRunning(false);
    setPaused(false);
    // Change #4: Turn LED off when experiment stops
    setLedOn(false);
    bleService.setLedOn(false).catch(() => {});

    if (samplesRef.current.length === 0) return;
    const pts = samplesRef.current;
    const meanI = pts.reduce((s, p) => s + p.intensity, 0) / pts.length;
    const meanA = pts.reduce((s, p) => s + p.absorbance, 0) / pts.length;
    const conc = activeCal ? invertCal(activeCal, meanA) : null;
    const st = threshold(conc, settings.safeMax, settings.warningMax);
    const meas: Measurement = {
      id: `${Date.now()}`,
      sampleId: sampleId || `SMP-${Date.now().toString().slice(-5)}`,
      operator: '',
      contaminant: contaminant || (activeCal?.contaminant ?? 'Unknown'),
      notes,
      wavelength: wavelength,
      calibrationId: activeCal?.id ?? null,
      createdAt: new Date().toISOString(),
      durationSec: pts[pts.length - 1].t,
      meanIntensity: meanI,
      meanAbsorbance: meanA,
      concentration: conc,
      status: st,
      points: pts.map((p) => ({ t: p.t, intensity: p.intensity, absorbance: p.absorbance })),
    };
    await addMeasurement(meas);
    setModalMsg({
      title: 'Saved',
      body: 'Measurement stored in history.',
      onView: () => router.push(`/measurement/${meas.id}`),
    });
  };

  const screenW = Dimensions.get('window').width - spacing.md * 2 - spacing.lg * 2;

  const wavelengthLabel = () => {
    return wavelength === 'red' ? '~635 nm (Red)' : wavelength === 'green' ? '~540 nm (Green)' : wavelength === 'blue' ? '~470 nm (Blue)' : 'Off';
  };

  const wavelengthColor = () => {
    if (wavelength === 'red') return colors.ledRed;
    if (wavelength === 'green') return colors.ledGreen;
    if (wavelength === 'blue') return colors.ledBlue;
    return colors.textSecondary;
  };

  // Change #5: Handle wavelength switch — if LED is already on, switch and glow; if off, just select
  const handleWavelengthChange = (w: Wavelength) => {
    setWavelength(w);
    if (ledOn) {
      // LED is already on — switch and keep glowing
      bleService.setWavelength(w).catch(() => {});
    }
    // If LED is off — just change selection, don't send to BLE
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Readouts */}
        <Card testID="live-readout-card" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Live Measurement</Label>
            <Badge
              testID="measure-state-badge"
              label={running ? (paused ? 'Paused' : 'Measuring') : 'Idle'}
              color={running && !paused ? colors.primary : colors.textSecondary}
            />
          </View>

          {/* Change #7: unit inline beside number */}
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5 }}>CONCENTRATION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text
                  testID="live-concentration"
                  style={{
                    color: colors.textPrimary,
                    fontSize: 52,
                    fontFamily: 'monospace',
                    fontVariant: ['tabular-nums'],
                    fontWeight: '600',
                    letterSpacing: -1,
                  }}
                >
                  {concFromCal != null ? concFromCal.toFixed(2) : '—'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 8 }}>
                  {concFromCal != null
                    ? settings.unit.replace('mg/L', 'mg/l').replace('MG/L', 'mg/l')
                    : 'No calibration active'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5 }}>ABSORBANCE (OD)</Text>
            <Text
              testID="live-absorbance"
              style={{
                color: colors.textPrimary,
                fontSize: 28,
                fontFamily: 'monospace',
                fontVariant: ['tabular-nums'],
                fontWeight: '600',
                marginTop: 2,
              }}
            >
              {absorbance.toFixed(3)}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5 }}>INTENSITY</Text>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontFamily: 'monospace',
                fontVariant: ['tabular-nums'],
                marginTop: 2,
              }}
            >
              {intensity.toFixed(0)}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Badge
              testID="threshold-badge"
              label={status === 'unknown' ? 'No calibration' : status}
              color={
                status === 'safe'
                  ? colors.safe
                  : status === 'warning'
                  ? colors.warning
                  : status === 'critical'
                  ? colors.critical
                  : colors.textSecondary
              }
            />
          </View>
        </Card>

        {/* Chart */}
        <Card style={{ marginBottom: spacing.md }}>
          <Label>Absorbance · Time</Label>
          <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Chart
              testID="live-chart"
              width={screenW}
              height={180}
              data={samples.map((s) => ({ x: s.t, y: s.absorbance }))}
              strokeColor={wavelengthColor()}
              xLabel="t (s)"
              yLabel="A"
            />
          </View>
        </Card>

        {/* Controls */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
          {!running ? (
            <CtrlBtn testID="start-btn" icon="play" label="Start" color={colors.primary} onPress={handleStart} big />
          ) : (
            <>
              <CtrlBtn
                testID="pause-btn"
                icon={paused ? 'play' : 'pause'}
                label={paused ? 'Resume' : 'Pause'}
                color={colors.warning}
                onPress={handlePause}
              />
              <CtrlBtn testID="stop-btn" icon="stop" label="Stop & Save" color={colors.critical} onPress={handleStop} />
            </>
          )}
        </View>

        {/* LED & Wavelength */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Label>LED · Wavelength</Label>
              {/* Change #2: removed "· Off" text — just show wavelength name */}
              <Text style={{ color: ledOn ? wavelengthColor() : colors.textSecondary, marginTop: 4, fontFamily: 'monospace', fontSize: 16 }}>
                {wavelengthLabel()}
              </Text>
            </View>
            <TouchableOpacity
              testID="led-toggle"
              onPress={() => setLedOn((v) => !v)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: ledOn ? colors.primary : colors.border,
                backgroundColor: ledOn ? colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: ledOn ? '#fff' : colors.textSecondary, fontWeight: '700', letterSpacing: 1 }}>
                LED {ledOn ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
            {(['red', 'green', 'blue'] as Wavelength[]).map((w) => {
              const wColor = w === 'red' ? colors.ledRed : w === 'green' ? colors.ledGreen : colors.ledBlue;
              const isSelected = wavelength === w;
              // Change #5: dot only glows (full opacity) when LED is on AND this wavelength selected
              const isGlowing = isSelected && ledOn;
              return (
                <TouchableOpacity
                  key={w}
                  testID={`wavelength-${w}`}
                  onPress={() => handleWavelengthChange(w)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: isSelected ? wColor : colors.border,
                    backgroundColor: isSelected ? colors.surfaceElevated : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: wColor,
                      marginBottom: 4,
                      // Dim when LED is off
                      opacity: isGlowing ? 1 : 0.25,
                    }}
                  />
                  <Text style={{ color: isSelected ? wColor : colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                    {w}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Sample info */}
        <Card style={{ marginBottom: spacing.md }}>
          <Label>Sample</Label>
          <TextInputRow testID="sample-id-input" value={sampleId} onChangeText={setSampleId} placeholder="Sample ID (auto if empty)" />
          <TextInputRow
            testID="contaminant-input"
            value={contaminant}
            onChangeText={setContaminant}
            placeholder="Contaminant (e.g. Nitrate)"
          />
          <TextInputRow testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
          <TextInputRow
            testID="blank-input"
            value={blankI0}
            onChangeText={setBlankI0}
            placeholder="Blank intensity I₀"
            keyboardType="numeric"
          />
          <Sub style={{ marginTop: 6 }}>A = log₁₀(I₀ / I). Measure blank first to set I₀.</Sub>
        </Card>
      </ScrollView>

      {/* Change #9: Styled in-app modal replaces all Alert popups */}
      <Modal visible={!!modalMsg} transparent animationType="fade" onRequestClose={() => setModalMsg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 340,
          }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>
              {modalMsg?.title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
              {modalMsg?.body}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {modalMsg?.onView && (
                <TouchableOpacity
                  onPress={() => { setModalMsg(null); modalMsg.onView?.(); }}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>View</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setModalMsg(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function invertCal(cal: any, absorbance: number): number | null {
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

function threshold(conc: number | null, safe: number, warn: number): 'safe' | 'warning' | 'critical' | 'unknown' {
  if (conc == null || isNaN(conc)) return 'unknown';
  if (conc <= safe) return 'safe';
  if (conc <= warn) return 'warning';
  return 'critical';
}

function CtrlBtn({ icon, label, color, onPress, testID, big }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: big ? 18 : 14,
        backgroundColor: color,
        borderRadius: radius.md,
        minHeight: big ? 60 : 48,
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1, marginLeft: 8 }}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

function TextInputRow({ value, onChangeText, placeholder, testID, multiline, keyboardType }: any) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      keyboardType={keyboardType}
      multiline={multiline}
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
