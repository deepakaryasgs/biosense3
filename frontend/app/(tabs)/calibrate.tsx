import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useStore, CalibrationProfile } from '../../src/store';
import { Card, Label, Title, Sub, Badge } from '../../src/components';
import { Chart } from '../../src/Chart';
import { spacing, radius } from '../../src/theme';
import { linearRegression, polynomialRegression } from '../../src/regression';

interface StandardRow {
  concentration: string;
  absorbance: string;
}

const DEFAULT_ROWS: StandardRow[] = [
  { concentration: '0', absorbance: '0' },
  { concentration: '5', absorbance: '0.12' },
  { concentration: '10', absorbance: '0.24' },
  { concentration: '20', absorbance: '0.48' },
];

export default function Calibrate() {
  const { colors } = useTheme();
  const { calibrations, activeCalibrationId, addCalibration, deleteCalibration, setActiveCalibrationId } = useStore();

  const [name, setName] = useState('');
  const [contaminant, setContaminant] = useState('');
  // Change #3: default unit mg/l (lowercase)
  const [unit, setUnit] = useState('mg/l');
  const [modelType, setModelType] = useState<'linear' | 'polynomial'>('linear');
  const [degree, setDegree] = useState(2);
  const [rows, setRows] = useState<StandardRow[]>(DEFAULT_ROWS);
  const [deleteTarget, setDeleteTarget] = useState<CalibrationProfile | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Change #9: When switching model type, reset rows to default so previous points don't bleed into new graph
  const handleModelTypeChange = (m: 'linear' | 'polynomial') => {
    setModelType(m);
    setRows(DEFAULT_ROWS);
  };

  const points = useMemo(
    () =>
      rows
        .map((r) => ({ x: Number(r.concentration), y: Number(r.absorbance) }))
        .filter((p) => !isNaN(p.x) && !isNaN(p.y)),
    [rows],
  );

  const regression = useMemo(() => {
    if (modelType === 'linear') return linearRegression(points);
    return polynomialRegression(points, degree);
  }, [modelType, points, degree]);

  const screenW = Dimensions.get('window').width - spacing.md * 2 - spacing.lg * 2;

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErrorMsg('Please name this calibration profile before saving.');
      return;
    }
    const c: CalibrationProfile = {
      id: `cal-${Date.now()}`,
      name: name.trim(),
      contaminant: contaminant.trim() || 'Unknown',
      unit: unit.trim() || 'mg/l',
      modelType,
      degree: regression.degree,
      coefficients: regression.coefficients,
      r2: regression.r2,
      equation: regression.equation,
      standards: points.map((p) => ({ concentration: p.x, absorbance: p.y })),
      createdAt: new Date().toISOString(),
    };
    await addCalibration(c);
    setSaveMsg(c.name);
    setName('');
  };

  const updateRow = (i: number, k: keyof StandardRow, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [k]: v };
    setRows(next);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <Sub style={{ marginTop: 4, marginBottom: spacing.md }}>
          Map absorbance to concentration with standards.
        </Sub>

        {/* Builder */}
        <Card style={{ marginBottom: spacing.md }} testID="cal-builder">
          <Label>New Profile</Label>
          <Input testID="cal-name" value={name} onChangeText={setName} placeholder="Profile name (e.g. Nitrate 540nm)" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Input testID="cal-contaminant" value={contaminant} onChangeText={setContaminant} placeholder="Contaminant" />
            </View>
            <View style={{ flex: 1 }}>
              {/* Change #3: placeholder mg/l */}
              <Input testID="cal-unit" value={unit} onChangeText={setUnit} placeholder="Unit (mg/l)" />
            </View>
          </View>

          {/* Change #9: use handleModelTypeChange to clear graph when switching */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm }}>
            {(['linear', 'polynomial', 'manual'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`model-${m}`}
                onPress={() => handleModelTypeChange(m)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: modelType === m ? colors.primary : colors.border,
                  backgroundColor: modelType === m ? colors.primary : 'transparent',
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: modelType === m ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {modelType === 'polynomial' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 10 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Degree</Text>
              {[2, 3, 4].map((d) => (
                <TouchableOpacity
                  key={d}
                  testID={`degree-${d}`}
                  onPress={() => setDegree(d)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: degree === d ? colors.primary : colors.border,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text style={{ color: degree === d ? colors.primary : colors.textSecondary }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}


          {(
            <View style={{ marginTop: spacing.md }}>
              <Label>Standards</Label>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 11, letterSpacing: 1 }}>CONC.</Text>
                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 11, letterSpacing: 1 }}>ABSORBANCE</Text>
                <View style={{ width: 28 }} />
              </View>
              {rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      testID={`std-conc-${i}`}
                      value={r.concentration}
                      onChangeText={(v) => updateRow(i, 'concentration', v)}
                      keyboardType="numeric"
                      placeholder="x"
                      compact
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      testID={`std-abs-${i}`}
                      value={r.absorbance}
                      onChangeText={(v) => updateRow(i, 'absorbance', v)}
                      keyboardType="numeric"
                      placeholder="y"
                      compact
                    />
                  </View>
                  <TouchableOpacity
                    testID={`std-del-${i}`}
                    onPress={() => setRows(rows.filter((_, idx) => idx !== i))}
                    style={{ width: 28, alignItems: 'center' }}
                  >
                    <MaterialCommunityIcons name="close" color={colors.textSecondary} size={18} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                testID="add-row-btn"
                onPress={() => setRows([...rows, { concentration: '', absorbance: '' }])}
                style={{
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: 'dashed',
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>+ Add Standard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Preview */}
          <View style={{ marginTop: spacing.md }}>
            <Label>Preview</Label>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <Chart
                testID="cal-preview-chart"
                width={screenW}
                height={160}
                data={[]}
                scatter={[{ data: points, color: colors.primary }]}
                fitFn={(x) => regression.predict(x)}
                xLabel={`Conc (${unit})`}
                yLabel="A"
              />
            </View>
            <Text
              style={{ color: colors.textPrimary, fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
              testID="cal-equation"
            >
              {regression.equation}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }} testID="cal-r2">
              R² = {regression.r2.toFixed(4)}
            </Text>
          </View>

          <TouchableOpacity
            testID="save-calibration-btn"
            onPress={save}
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.primary,
              padding: 14,
              borderRadius: radius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>SAVE PROFILE</Text>
          </TouchableOpacity>
        </Card>

        {/* Saved */}
        <Label style={{ marginBottom: spacing.sm }}>Saved Profiles ({calibrations.length})</Label>
        {calibrations.length === 0 && (
          <Card>
            <Sub>No saved calibrations yet.</Sub>
          </Card>
        )}
        {calibrations.map((c) => {
          const active = c.id === activeCalibrationId;
          return (
            <Card key={c.id} testID={`cal-${c.id}`} style={{ marginBottom: spacing.sm, borderColor: active ? colors.primary : colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{c.name}</Text>
                  <Sub style={{ marginTop: 2 }}>
                    {c.contaminant} · {c.unit} · {c.modelType}
                    {c.modelType === 'polynomial' ? ` deg ${c.degree}` : ''}
                  </Sub>
                  <Text style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>{c.equation}</Text>
                  <Text style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>R² = {c.r2.toFixed(4)}</Text>
                </View>
                {active && <Badge label="Active" color={colors.primary} />}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                <TouchableOpacity
                  testID={`activate-${c.id}`}
                  onPress={() => setActiveCalibrationId(active ? null : c.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    alignItems: 'center',
                    backgroundColor: active ? 'transparent' : colors.primary,
                  }}
                >
                  <Text style={{ color: active ? colors.primary : '#fff', fontWeight: '700' }}>
                    {active ? 'Deactivate' : 'Set Active'}
                  </Text>
                </TouchableOpacity>
                {/* Change #10: styled in-app delete confirmation modal instead of Alert */}
                <TouchableOpacity
                  testID={`delete-${c.id}`}
                  onPress={() => setDeleteTarget(c)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.critical} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Change #9: Styled error modal */}
      <Modal visible={!!errorMsg} transparent animationType="fade" onRequestClose={() => setErrorMsg(null)}>
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
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>Required</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>{errorMsg}</Text>
            <TouchableOpacity
              onPress={() => setErrorMsg(null)}
              style={{ paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change #9: Styled save confirmation modal */}
      <Modal visible={!!saveMsg} transparent animationType="fade" onRequestClose={() => setSaveMsg(null)}>
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
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>Saved</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
              Calibration "{saveMsg}" saved successfully.
            </Text>
            <TouchableOpacity
              onPress={() => setSaveMsg(null)}
              style={{ paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Styled delete confirmation modal */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
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
            maxWidth: 340,
          }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 17, marginBottom: 8 }}>
              Delete Calibration?
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: spacing.lg }}>
              "{deleteTarget?.name}" will be permanently removed.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (deleteTarget) deleteCalibration(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.critical,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Input({ value, onChangeText, placeholder, testID, keyboardType, compact }: any) {
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
        marginTop: compact ? 0 : 10,
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
