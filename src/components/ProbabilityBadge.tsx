import { View, Text, StyleSheet } from 'react-native'
import { ProbabilityLevel } from '../types'
import { COLORS } from '../types/constants'

interface Props {
  probability: ProbabilityLevel
  size?: 'small' | 'medium' | 'large'
}

const PROBABILITY_COLORS: Record<ProbabilityLevel, string> = {
  alta: COLORS.probabilityHigh,
  media: COLORS.probabilityMedium,
  baja: COLORS.probabilityLow,
  pendiente: COLORS.probabilityPending,
}

const PROBABILITY_LABELS: Record<ProbabilityLevel, string> = {
  alta: 'Alta probabilidad',
  media: 'Probabilidad media',
  baja: 'Baja probabilidad',
  pendiente: 'Pendiente',
}

export function ProbabilityBadge({ probability, size = 'medium' }: Props) {
  const color = PROBABILITY_COLORS[probability]
  const label = PROBABILITY_LABELS[probability]
  const fontSize = size === 'small' ? 11 : size === 'large' ? 16 : 13
  const padding = size === 'small' ? '4px 8px' : size === 'large' ? '8px 16px' : '6px 12px'

  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color, padding }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color, fontSize }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontWeight: '600',
  },
})
