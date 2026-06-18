import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { COLORS, ROCK_TYPES } from '../types/constants'
import { getAllSamples, getSamplesByStatus } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { SampleCard } from '../components/SampleCard'
import { Sample } from '../types'

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'validado', label: 'Validadas' },
  { key: 'descartado', label: 'Descartadas' },
]

export function SampleListScreen({ navigation }: any) {
  const { samples, setSamples } = useAppStore()
  const [statusFilter, setStatusFilter] = useState('all')
  const [rockFilter, setRockFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSamples()
  }, [statusFilter])

  useFocusEffect(
    useCallback(() => {
      loadSamples()
    }, [statusFilter])
  )

  const loadSamples = async () => {
    const data = statusFilter === 'all'
      ? await getAllSamples()
      : await getSamplesByStatus(statusFilter)
    if (data.length > 0) setSamples(data)
  }

  const filteredSamples = useMemo(() => {
    let list = samples
    if (rockFilter !== 'all') {
      list = list.filter(s => s.estimatedRockType === rockFilter)
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      list = list.filter(s =>
        s.estimatedRockType.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.operatorName || '').toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      )
    }
    return list
  }, [samples, rockFilter, searchText])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadSamples()
    setRefreshing(false)
  }, [statusFilter])

  const handleSamplePress = (sample: Sample) => {
    navigation.navigate('SampleDetail', { sampleId: sample.id })
  }

  const showRockFilter = rockFilter !== 'all'

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muestras</Text>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por tipo, notas, operador..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status filter */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rock type filter */}
      <View style={styles.rockFilterRow}>
        <TouchableOpacity
          style={[styles.rockFilterBtn, rockFilter === 'all' && styles.rockFilterActive]}
          onPress={() => setRockFilter('all')}
        >
          <Text style={[styles.rockFilterText, rockFilter === 'all' && styles.rockFilterTextActive]}>
            Todas las rocas
          </Text>
        </TouchableOpacity>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROCK_TYPES}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.rockFilterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.rockFilterBtn, rockFilter === item.id && styles.rockFilterActive]}
              onPress={() => setRockFilter(item.id)}
            >
              <Text style={[styles.rockFilterText, rockFilter === item.id && styles.rockFilterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredSamples}
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
            <Text style={styles.emptyText}>
              {searchText || rockFilter !== 'all'
                ? 'No se encontraron muestras con esos filtros'
                : 'No hay muestras registradas'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchText || rockFilter !== 'all'
                ? 'Intenta con otros términos de búsqueda'
                : 'Use la cámara para analizar y registrar rocas'}
            </Text>
          </View>
        }
        contentContainerStyle={filteredSamples.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  clearBtn: { color: COLORS.textMuted, fontSize: 16, padding: 4 },
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
  rockFilterRow: {
    marginBottom: 4,
    paddingLeft: 16,
  },
  rockFilterList: {
    gap: 6,
    paddingRight: 16,
    paddingVertical: 4,
  },
  rockFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rockFilterActive: {
    backgroundColor: COLORS.accent + '30',
    borderColor: COLORS.accent,
  },
  rockFilterText: { color: COLORS.textSecondary, fontSize: 12 },
  rockFilterTextActive: { color: COLORS.accent, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 16 },
  emptySubtext: { color: COLORS.textMuted, fontSize: 13, marginTop: 8 },
})
