import React from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';

function AppHeader({ subtitle }: { subtitle: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ justifyContent: 'center', paddingVertical: 4, paddingLeft: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="water-opacity" size={30} color={colors.primary} />
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
          Aqua<Text style={{ color: colors.primary }}>Spec</Text>
        </Text>
      </View>
      <Text style={{
        color: colors.textSecondary,
        fontSize: 12,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        marginTop: 4,
        marginLeft: 38,
        fontWeight: '600',
      }}>
        {subtitle}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background, height: 90 },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        headerTitleContainerStyle: { paddingLeft: 8 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <AppHeader subtitle="Home" />,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />,
          tabBarButtonTestID: 'tab-dashboard',
        }}
      />
      <Tabs.Screen
        name="measure"
        options={{
          title: 'Measure',
          headerTitle: () => <AppHeader subtitle="Measure" />,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="test-tube" color={color} size={size} />,
          tabBarButtonTestID: 'tab-measure',
        }}
      />
      <Tabs.Screen
        name="calibrate"
        options={{
          title: 'Calibrate',
          headerTitle: () => <AppHeader subtitle="Calibrate" />,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="tune-vertical" color={color} size={size} />,
          tabBarButtonTestID: 'tab-calibrate',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerTitle: () => <AppHeader subtitle="History" />,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" color={color} size={size} />,
          tabBarButtonTestID: 'tab-history',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: () => <AppHeader subtitle="Settings" />,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" color={color} size={size} />,
          tabBarButtonTestID: 'tab-settings',
        }}
      />
    </Tabs>
  );
}
