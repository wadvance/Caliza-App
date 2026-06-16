import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { COLORS } from '../types/constants'
import { getAllSamples, getSamplesByStatus } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { SampleCard } from '../components/SampleCard'
import { Sample } from '../types'

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'validado', label: 'Validadas' },
  { key: 'descartado', label: 'Descartadas' },
]

export function SampleListScreen({ navigation }: any) {
  const { samples, setSamples } = useAppStore()
  const [filter, setFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSamples()
  }, [filter])

  const loadSamples = async () => {
    const data = filter === 'all'
      ? await getAllSamples()
      : await getSamplesByStatus(filter)
    setSamples(data)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadSamples()
    setRefreshing(false)
  }, [filter])

  const handleSamplePress = (sample: Sample) => {
    navigation.navigate('SampleDetail', { sampleId: sample.id })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muestras</Text>

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={samples}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <SampleCard sample={item} onPress={handleSamplePress} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay muestras registradas</Text>
            <Text style={styles.emptySubtext}>
              Use la cámara para analizar y registrar rocas
            </Text>
          </View>
        }
        contentContainerStyle={samples.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
  },
  filterActive: { backgroundColor: COLORS.accent },
  filterText: { color: COLORS.textSecondary, fontSize: 13 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 16 },
  emptySubtext: { color: COLORS.textMuted, fontSize: 13, marginTop: 8 },
})
