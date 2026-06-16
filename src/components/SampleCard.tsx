import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { Sample } from '../types'
import { COLORS } from '../types/constants'
import { ProbabilityBadge } from './ProbabilityBadge'
import { SAMPLE_STATUS_LABELS } from '../types/constants'

interface Props {
  sample: Sample
  onPress: (sample: Sample) => void
}

export function SampleCard({ sample, onPress }: Props) {
  const statusColor =
    sample.status === 'validado' ? COLORS.success :
    sample.status === 'descartado' ? COLORS.danger :
    COLORS.warning

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(sample)} activeOpacity={0.7}>
      {sample.photoUri.length > 0 && (
        <Image source={{ uri: sample.photoUri[0] }} style={styles.photo} />
      )}
      <View style={styles.info}>
        <View style={styles.header}>
          <Text style={styles.rockType}>{sample.estimatedRockType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {SAMPLE_STATUS_LABELS[sample.status] || sample.status}
            </Text>
          </View>
        </View>
        <Text style={styles.coords}>
          {sample.latitude.toFixed(4)}, {sample.longitude.toFixed(4)}
        </Text>
        {sample.notes && (
          <Text style={styles.notes} numberOfLines={2}>{sample.notes}</Text>
        )}
        <View style={styles.footer}>
          <ProbabilityBadge
            probability={
              sample.confidenceLevel > 0.6 ? 'alta' :
              sample.confidenceLevel > 0.3 ? 'media' : 'baja'
            }
            size="small"
          />
          <Text style={styles.date}>
            {new Date(sample.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.surfaceLight,
  },
  info: {
    padding: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rockType: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  coords: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  notes: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
})
