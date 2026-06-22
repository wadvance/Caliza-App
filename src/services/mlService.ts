import { Platform } from 'react-native'
import { MLPrediction } from '../types'

let model: any = null
let modelLoaded = false

const isWeb = Platform.OS === 'web'

let _FileSystem: any = null
async function getFileSystem(): Promise<any> {
  if (_FileSystem) return _FileSystem
  try {
    _FileSystem = require('expo-file-system')
  } catch {
    _FileSystem = {
      documentDirectory: '/',
      bundleDirectory: '/',
      getInfoAsync: async () => ({ exists: false }),
      copyAsync: async () => {},
    }
  }
  return _FileSystem
}

export async function loadMLModel(): Promise<boolean> {
  if (isWeb) return false
  try {
    const FileSystem = await getFileSystem()
    const modelPath = `${FileSystem.documentDirectory}models/caliza_model.json`
    const exists = await FileSystem.getInfoAsync(modelPath)
    if (!exists.exists) {
      const bundlePath = FileSystem.bundleDirectory + 'models/caliza_model.json'
      const bundleExists = await FileSystem.getInfoAsync(bundlePath)
      if (!bundleExists.exists) {
        console.warn('ML model not found, using rule-based fallback')
        modelLoaded = true
        return false
      }
      await FileSystem.copyAsync({ from: bundlePath, to: modelPath })
    }
    modelLoaded = true
    return true
  } catch (err) {
    console.warn('Failed to load ML model:', err)
    modelLoaded = true
    return false
  }
}

export async function classifyImage(imageUri: string): Promise<MLPrediction> {
  if (!modelLoaded) await loadMLModel()

  if (model) {
    try {
      const imageTensor = await imageToTensor(imageUri)
      const predictions = await model.predict(imageTensor)
      return parseModelOutput(predictions)
    } catch {
      return await ruleBasedClassification(imageUri)
    }
  }

  return await ruleBasedClassification(imageUri)
}

async function imageToTensor(uri: string): Promise<any> {
  const response = await fetch(uri)
  const imageData = await response.arrayBuffer()
  return new Float32Array(imageData)
}

function parseModelOutput(predictions: any): MLPrediction {
  const allProb = predictions.allProbabilities || {
    'caliza': predictions.probability || 0,
    'dolomita': Math.max(0, (predictions.probability || 0) - 0.2),
    'arcilla': Math.max(0, 1 - (predictions.probability || 0) - 0.3),
    'marga': Math.max(0, 1 - (predictions.probability || 0) - 0.4),
    'desconocido': Math.max(0, 1 - (predictions.probability || 0)),
  }
  return {
    className: predictions.className || 'desconocido',
    probability: predictions.probability || 0,
    allProbabilities: allProb,
    dominantFeatures: [],
    recommendations: [
      'Realizar prueba con ácido clorhídrico diluido',
      'Verificar dureza y textura',
      'Tomar muestra para laboratorio',
    ],
  }
}

export async function ruleBasedClassification(imageUri: string): Promise<MLPrediction> {
  const features = await extractFeatures(imageUri)

  const reasons: string[] = []
  const brightness = features.rawBrightness ?? 128
  const saturation = features.rawSaturation ?? 0.3

  const isLight = brightness > 160 && saturation < 0.25
  const isVeryLight = brightness > 200 && saturation < 0.15
  const isMedium = brightness >= 100 && brightness <= 160
  const isDark = brightness < 100

  let calizaScore = 0

  if (isVeryLight) {
    calizaScore = 0.8 + features.textureScore * 0.15
    reasons.push('Color muy claro (blanco/beige) típico de caliza pura')
  } else if (isLight) {
    calizaScore = 0.4 + features.textureScore * 0.2
    reasons.push('Color claro - posible carbonato')
  } else if (isMedium) {
    calizaScore = 0.1 + features.textureScore * 0.1
    reasons.push('Color intermedio - poco característico de caliza')
  } else {
    calizaScore = 0.03
    reasons.push('Color oscuro - no característico de carbonatos')
  }

  if (features.textureScore > 0.7) calizaScore += 0.05
  if (features.granulometryScore > 0.6) calizaScore += 0.03
  if (features.fractureScore > 0.5) calizaScore += 0.02

  const probability = Math.min(calizaScore, 0.95)

  const recommendations: string[] = []
  if (probability > 0.7) {
    recommendations.push('Alta probabilidad de caliza - validar con HCl diluido')
  } else if (probability > 0.4) {
    recommendations.push('Probabilidad media - realizar prueba de ácido y dureza')
  } else if (probability > 0.15) {
    recommendations.push('Baja probabilidad de caliza - buscar rocas de color más claro')
  } else {
    recommendations.push('No parece caliza - buscar afloramientos de color blanco/beige')
  }
  recommendations.push('Registrar coordenadas GPS exactas')
  recommendations.push('Tomar múltiples fotos desde diferentes ángulos')

  let className = 'desconocido'
  if (probability > 0.65) className = 'caliza'
  else if (probability > 0.35) className = 'posible_caliza'

  const calizaDisplay = (isVeryLight || isLight) ? probability : 0

  const allProbabilities: Record<string, number> = {
    caliza: calizaDisplay,
    desconocido: Math.max(0, 1 - calizaDisplay),
  }
  if (isVeryLight || isLight) {
    allProbabilities.dolomita = probability * 0.4
    allProbabilities.caliche = probability * 0.3
    allProbabilities.marga = probability * 0.25
  }
  if (isDark) {
    allProbabilities.basalto = 0.4
    allProbabilities.granito = 0.3
    allProbabilities.arcilla = 0.2
  } else if (!isVeryLight && !isLight) {
    allProbabilities.arcilla = 0.35
    allProbabilities.yeso = 0.1
  }

  return {
    className,
    probability: Math.round(probability * 100) / 100,
    allProbabilities,
    dominantFeatures: reasons,
    recommendations,
  }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = uri
  })
}

async function extractFeatures(uri: string): Promise<FeatureScores> {
  try {
    if (typeof document === 'undefined') return defaultScores()
    const img = await loadImage(uri)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return defaultScores()
    const w = 64, h = 64
    canvas.width = w
    canvas.height = h
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data

    let totalR = 0, totalG = 0, totalB = 0
    const brightnessValues: number[] = []

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      totalR += r; totalG += g; totalB += b
      brightnessValues.push((r + g + b) / 3)
    }

    const n = data.length / 4
    const avgR = totalR / n, avgG = totalG / n, avgB = totalB / n
    const avgBrightness = (avgR + avgG + avgB) / 3
    const avgSaturation = (Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB)) / 255

    let brightnessVariance = 0
    for (const b of brightnessValues) {
      brightnessVariance += (b - avgBrightness) ** 2
    }
    brightnessVariance = Math.sqrt(brightnessVariance / n) / 255

    const textureScore = 1 - brightnessVariance
    const lightness = avgBrightness / 255
    const granulometryScore = lightness > 0.5 ? 0.5 + lightness * 0.3 : 0.2 + lightness * 0.3
    const fractureScore = 0.2 + brightnessVariance * 0.6
    const veinScore = 0.15 + brightnessVariance * 0.5

    return {
      colorScore: 0.5,
      textureScore,
      granulometryScore,
      fractureScore,
      veinScore,
      rawBrightness: avgBrightness,
      rawSaturation: avgSaturation,
    }
  } catch {
    return defaultScores()
  }
}

function defaultScores(): FeatureScores {
  return { colorScore: 0.5, textureScore: 0.5, granulometryScore: 0.5, fractureScore: 0.4, veinScore: 0.3, rawBrightness: 128, rawSaturation: 0.3 }
}

interface FeatureScores {
  colorScore: number
  textureScore: number
  granulometryScore: number
  fractureScore: number
  veinScore: number
  rawBrightness?: number
  rawSaturation?: number
}

export function getConfidenceLabel(probability: number): string {
  if (probability >= 0.8) return 'Muy alta'
  if (probability >= 0.6) return 'Alta'
  if (probability >= 0.4) return 'Media'
  if (probability >= 0.2) return 'Baja'
  return 'Muy baja'
}

export function getDominantFeatures(prediction: MLPrediction): string[] {
  return prediction.dominantFeatures.length > 0
    ? prediction.dominantFeatures
    : ['Análisis visual preliminar', 'Requiere validación en campo']
}
