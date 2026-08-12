import { StyleSheet, View } from 'react-native';
import { brand, progressSize, radii, surface } from '@/src/shared/theme';

export function ProgressBar({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const value = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, compact && styles.compact]}>
      <View style={[styles.fill, { width: `${value * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: progressSize.standard,
    overflow: 'hidden',
  },
  compact: {
    height: progressSize.compact,
  },
  fill: {
    backgroundColor: brand[700],
    borderRadius: radii.full,
    height: '100%',
  },
});
