import { useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native'
import { COLORS, ROCK_TYPES } from '../types/constants'
import { useAppStore } from '../store/useAppStore'
import { getAllSamples, getAllZones } from '../services/database'
import { syncNow, startAutoSync, onSyncStatus, isOnline } from '../services/syncService'

const { width } = Dimensions.get('window')

function AnimatedCounter({ to, label, color, suffix = '' }: { to: number; label: string; color: string; suffix?: string }) {
  const val = useRef(new Animated.Value(0)).current
  const display = useRef('0')

  useEffect(() => {
    val.setValue(0)
    Animated.timing(val, {
      toValue: to,
      duration: 1500,
      useNativeDriver: false,
    }).start()
    const id = val.addListener(({ value }) => {
      display.current = Math.floor(value).toString()
    })
    return () => val.removeListener(id)
  }, [to])

  return (
    <View style={[styles.counterCard, { borderLeftColor: color }]}>
      <Animated.Text style={[styles.counterValue, { color }]}>
        {display.current}
      </Animated.Text>
      <Text style={styles.counterLabel}>{label}</Text>
      {suffix ? <Text style={[styles.counterSuffix, { color }]}>{suffix}</Text> : null}
    </View>
  )
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0)
  if (total === 0) return null
  const sorted = [...segments].filter(s => s.value > 0).sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 6)

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>Distribución de rocas</Text>
      <View style={styles.chartBody}>
        <View style={styles.donut}>
          {top.map((seg, i) => {
            const pct = (seg.value / total) * 360
            return (
              <View
                key={seg.label}
                style={[
                  styles.donutSegment,
                  {
                    backgroundColor: seg.color,
                    transform: [{ rotateZ: `${top.slice(0, i).reduce((s, x) => s + (x.value / total) * 360, 0)}deg` }],
                  },
                ]}
              />
            )
          })}
          <View style={styles.donutHole}>
            <Text style={styles.donutTotal}>{total}</Text>
            <Text style={styles.donutLabel}>total</Text>
          </View>
        </View>
        <View style={styles.legend}>
          {top.map(s => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
              <Text style={styles.legendValue}>{((s.value / total) * 100).toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function StatCard({ icon, title, value, color, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()
  const onPressOut = () => Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start()

  return (
    <Animated.View style={[styles.statCard, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.statCardInner}
      >
        <View style={[styles.statIconWrap, { backgroundColor: color + '25' }]}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <View style={styles.statInfo}>
          <Text style={[styles.statTitle, { color }]}>{value}</Text>
          <Text style={styles.statSubtitle}>{title}</Text>
        </View>
        <View style={[styles.statGlow, { backgroundColor: color + '15' }]} />
      </TouchableOpacity>
    </Animated.View>
  )
}

function ActivityItem({ icon, text, time, index }: { icon: string; text: string; time: string; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[styles.activityItem, { opacity, transform: [{ translateX }] }]}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>{text}</Text>
        <Text style={styles.activityTime}>{time}</Text>
      </View>
    </Animated.View>
  )
}

export function DashboardScreen({ navigation }: any) {
  const { samples, zones, isOffline, syncStatus, setSamples, setZones, setIsOffline } = useAppStore()
  const fadeIn = useRef(new Animated.Value(0)).current
  const bgPulse = useRef(new Animated.Value(0)).current
  const orb1 = useRef(new Animated.Value(0)).current
  const orb2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(orb1, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(orb1, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(orb2, { toValue: 0, duration: 5000, useNativeDriver: true }),
          Animated.timing(orb2, { toValue: 1, duration: 5000, useNativeDriver: true }),
        ])
      ),
    ]).start()
    loadData()
    isOnline().then(online => setIsOffline(!online))
    const unsub = onSyncStatus(() => {})
    return unsub
  }, [])

  const loadData = async () => {
    const loadedSamples = samples.length > 0 ? samples : await getAllSamples()
    const loadedZones = zones.length > 0 ? zones : await getAllZones()
    if (samples.length === 0) setSamples(loadedSamples)
    if (zones.length === 0) setZones(loadedZones)

    Animated.sequence([
      Animated.timing(bgPulse, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bgPulse, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()
  }

  const validatedCount = samples.filter(s => s.status === 'validado').length
  const pendingCount = samples.filter(s => s.status === 'pendiente').length
  const totalZones = zones.length
  const avgConf = samples.length > 0
    ? (samples.reduce((a, s) => a + s.confidenceLevel, 0) / samples.length * 100).toFixed(0)
    : '0'

  const rockDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    ROCK_TYPES.forEach(r => { counts[r.id] = 0 })
    samples.forEach(s => {
      const id = s.estimatedRockType?.toLowerCase()
      if (id && counts[id] !== undefined) counts[id]++
    })
    return ROCK_TYPES
      .filter(r => (counts[r.id] || 0) > 0)
      .map(r => ({ label: r.label, value: counts[r.id] || 0, color: r.color }))
  }, [samples])

  const recentActivities = useMemo(() => {
    const acts: { icon: string; text: string; time: string }[] = []
    const sorted = [...samples].sort((a, b) => b.timestamp - a.timestamp)
    sorted.slice(0, 5).forEach(s => {
      acts.push({
        icon: '📷',
        text: `Muestra "${s.estimatedRockType}" ${s.status === 'validado' ? '✅ validada' : s.status === 'descartado' ? '❌ descartada' : '⏳ pendiente'}`,
        time: new Date(s.timestamp).toLocaleDateString(),
      })
    })
    if (sorted.length === 0) {
      acts.push({ icon: '👋', text: 'Bienvenido a GeoCaliza. Usa la cámara para comenzar.', time: 'ahora' })
    }
    if (syncStatus.lastSync) {
      acts.push({
        icon: '📡',
        text: `Sincronizado: ${new Date(syncStatus.lastSync).toLocaleString()}`,
        time: 'última sinc.',
      })
    }
    return acts
  }, [samples, syncStatus.lastSync])

  const handleQuickAction = (screen: string, params?: any) => {
    try { navigation.navigate(screen, params) } catch {}
  }

  return (
    <View style={styles.container}>
      {/* Animated background orbs */}
      <Animated.View style={[styles.orb, styles.orb1, {
        opacity: orb1.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }),
        transform: [{
          translateX: orb1.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] }),
        }, {
          translateY: orb1.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }),
        }],
      }]} />
      <Animated.View style={[styles.orb, styles.orb2, {
        opacity: orb2.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.15] }),
        transform: [{
          translateX: orb2.interpolate({ inputRange: [0, 1], outputRange: [20, -20] }),
        }, {
          translateY: orb2.interpolate({ inputRange: [0, 1], outputRange: [10, -10] }),
        }],
      }]} />

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeIn }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>⛰️ GeoCaliza</Text>
            <Text style={styles.greetingSub}>Panel de exploración</Text>
          </View>
          <View style={styles.syncBadge}>
            <View style={[styles.syncDot, { backgroundColor: isOffline ? COLORS.danger : COLORS.success }]} />
            <Text style={styles.syncText}>{isOffline ? 'offline' : 'online'}</Text>
          </View>
        </View>

        {/* Animated counters row */}
        <View style={styles.countersRow}>
          <AnimatedCounter to={samples.length} label="Muestras" color={COLORS.highlight} />
          <AnimatedCounter to={totalZones} label="Zonas caliza" color={COLORS.success} suffix="zonas" />
          <AnimatedCounter to={parseInt(avgConf)} label="Confianza media" color={COLORS.warning} suffix="%" />
        </View>

        {/* Quick action cards */}
        <View style={styles.quickActions}>
          <StatCard icon="📷" title="Escanear roca" value="Cámara" color={COLORS.highlight}
            onPress={() => handleQuickAction('Camara', { screen: 'CameraMain' })} />
          <StatCard icon="🗺️" title="Ver mapa" value="Mapa" color={COLORS.success}
            onPress={() => handleQuickAction('Mapa', { screen: 'MapMain' })} />
          <StatCard icon="📊" title="Generar reporte" value="Reportes" color={COLORS.warning}
            onPress={() => handleQuickAction('Más', { screen: 'Reports' })} />
          <StatCard icon={syncStatus.syncing ? '⏳' : '📡'} title={syncStatus.syncing ? 'Sincronizando...' : 'Toca para sinc.'} value={syncStatus.syncing ? `${syncStatus.progress}/${syncStatus.total}` : 'Sincronizar'} color={COLORS.probabilityPending}
            onPress={async () => { await syncNow(); loadData() }} />
        </View>

        {/* Donut chart */}
        {rockDistribution.length > 0 && <DonutChart segments={rockDistribution} />}

        {/* Status summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.success }]}>
            <Text style={styles.summaryValue}>{validatedCount}</Text>
            <Text style={styles.summaryLabel}>Validadas</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.warning }]}>
            <Text style={styles.summaryValue}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>Pendientes</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.danger }]}>
            <Text style={styles.summaryValue}>{samples.length - validatedCount - pendingCount}</Text>
            <Text style={styles.summaryLabel}>Descartadas</Text>
          </View>
        </View>

        {/* Recent activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {recentActivities.map((act, i) => (
            <ActivityItem key={i} icon={act.icon} text={act.text} time={act.time} index={i} />
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  orb: {
    position: 'absolute',
    borderRadius: 200,
    zIndex: 0,
  },
  orb1: {
    width: 280,
    height: 280,
    backgroundColor: COLORS.highlight,
    top: -60,
    right: -80,
  },
  orb2: {
    width: 200,
    height: 200,
    backgroundColor: COLORS.probabilityPending,
    bottom: 60,
    left: -60,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 56,
  },
  greeting: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  greetingSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  countersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  counterCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterValue: { fontSize: 28, fontWeight: '800' },
  counterLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  counterSuffix: { fontSize: 11, fontWeight: '700', marginTop: -2 },

  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 44) / 2,
  },
  statCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIcon: { fontSize: 20 },
  statInfo: { flex: 1 },
  statTitle: { fontSize: 15, fontWeight: '700' },
  statSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 1 },
  statGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  chartContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  chartBody: { flexDirection: 'row', gap: 16 },
  donut: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  donutSegment: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 55,
    opacity: 0.85,
  },
  donutHole: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  donutTotal: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  donutLabel: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase' },
  legend: { flex: 1, justifyContent: 'center', gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, textTransform: 'capitalize' },
  legendValue: { color: COLORS.text, fontSize: 12, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  summaryValue: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textTransform: 'uppercase' },

  activitySection: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityIcon: { fontSize: 16, marginTop: 2 },
  activityContent: { flex: 1 },
  activityText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  activityTime: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
})
