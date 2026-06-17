import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { COLORS } from '../types/constants'

const STEPS = [
  {
    icon: '🔓',
    title: 'Abrir la app',
    desc: 'El geólogo o técnico inicia sesión en GeoCaliza desde su dispositivo móvil.',
  },
  {
    icon: '🗺️',
    title: 'Descargar mapas offline',
    desc: 'Descarga los mapas de la zona de interés para tenerlos disponibles sin conexión a internet.',
  },
  {
    icon: '📍',
    title: 'Ir a puntos sugeridos',
    desc: 'El sistema muestra zonas de alta probabilidad en el mapa. Dirígete a esos puntos para inspeccionar.',
  },
  {
    icon: '📷',
    title: 'Escanea afloramientos',
    desc: 'Usa la cámara para analizar afloramientos rocosos. El sistema clasifica el tipo de roca automáticamente.',
  },
  {
    icon: '📋',
    title: 'Registrar muestras',
    desc: 'Cada análisis guarda coordenadas, foto, tipo de roca estimado y nivel de confianza.',
  },
  {
    icon: '🧪',
    title: 'Prueba rápida',
    desc: 'Si aplica, realiza la prueba de ácido (HCl) directamente desde la app y registra el resultado.',
  },
  {
    icon: '💾',
    title: 'Guardar coordenadas y fotos',
    desc: 'Toda la información se almacena localmente en el dispositivo con las coordenadas GPS exactas.',
  },
  {
    icon: '📡',
    title: 'Sincronizar al volver a internet',
    desc: 'Al recuperar la conexión, la app sincroniza automáticamente los datos con el servidor central.',
  },
  {
    icon: '🤖',
    title: 'Modelo de predicción',
    desc: 'El sistema actualiza el modelo de predicción con los nuevos datos recolectados en campo.',
  },
  {
    icon: '📊',
    title: 'Panel web',
    desc: 'La empresa visualiza resultados, reportes y estadísticas desde el panel web de administración.',
  },
]

export function WorkflowGuideScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>⛰️</Text>
        <Text style={styles.title}>Flujo de trabajo en campo</Text>
        <Text style={styles.subtitle}>
          Guía paso a paso para el uso de GeoCaliza en exploraciones de caliza
        </Text>
      </View>

      {STEPS.map((step, index) => (
        <View key={index} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
            </View>
            <Text style={styles.stepDesc}>{step.desc}</Text>
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          GeoCaliza v1.0 — Optimizado para exploración offline de caliza
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  step: {
    flexDirection: 'row',
    padding: 16,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  stepNumberText: { color: COLORS.accent, fontSize: 14, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepIcon: { fontSize: 20, marginRight: 8 },
  stepTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  stepDesc: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 28 },
  footer: { padding: 24, alignItems: 'center' },
  footerText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
})
