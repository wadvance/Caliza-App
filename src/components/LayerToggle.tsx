import { View, Text, Switch, StyleSheet } from 'react-native'
import { GeologicalLayer } from '../types'
import { COLORS } from '../types/constants'

const LAYER_ICONS: Record<string, string> = {
  satellite: '🛰️',
  geological: '🗺️',
  potential: '✅',
  extraction: '⛏️',
  samples: '📍',
  routes: '🛣️',
}

interface Props {
  layer: GeologicalLayer
  onToggle: (id: string) => void
}

export function LayerToggle({ layer, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{LAYER_ICONS[layer.id] || '📋'}</Text>
      <Text style={styles.label}>{layer.name}</Text>
      <Switch
        value={layer.visible}
        onValueChange={() => onToggle(layer.id)}
        trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
        thumbColor={layer.visible ? COLORS.highlight : COLORS.textMuted}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
})
