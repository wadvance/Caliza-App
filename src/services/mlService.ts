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

  let calizaScore = 0
  const reasons: string[] = []

  const c = features.colorScore
  const t = features.textureScore
  const g = features.granulometryScore
  const f = features.fractureScore
  const v = features.veinScore

  if (c > 0.5) {
    const contrib = 0.15 + (c - 0.5) * 0.3
    calizaScore += contrib
    reasons.push('Color claro característico de carbonatos')
  } else if (c > 0.3) {
    calizaScore += 0.08
    reasons.push('Color ligeramente claro')
  } else {
    calizaScore += 0.03
    reasons.push('Color no concluyente')
  }

  if (t > 0.5) {
    const contrib = 0.1 + (t - 0.5) * 0.3
    calizaScore += contrib
    reasons.push('Textura homogénea compatible con sedimentaria')
  } else if (t > 0.3) {
    calizaScore += 0.06
    reasons.push('Textura parcialmente homogénea')
  } else {
    calizaScore += 0.02
  }

  if (g > 0.4) {
    calizaScore += 0.08 + (g - 0.4) * 0.15
    reasons.push('Granulometría fina a media')
  }

  if (f > 0.35) {
    calizaScore += 0.05 + (f - 0.35) * 0.1
    reasons.push('Patrón de fractura presente')
  }

  if (v > 0.25) {
    calizaScore += 0.04 + (v - 0.25) * 0.1
    reasons.push('Posibles vetas de calcita')
  }

  const probability = Math.min(calizaScore, 0.95)

  const recommendations: string[] = []
  if (probability > 0.7) {
    recommendations.push('Alta probabilidad de caliza - validar con HCl diluido')
  } else if (probability > 0.5) {
    recommendations.push('Probabilidad media-alta - realizar prueba de ácido y dureza')
  } else if (probability > 0.3) {
    recommendations.push('Probabilidad media - verificar con prueba de HCl en campo')
  } else {
    recommendations.push('Baja probabilidad - buscar afloramientos de color claro')
  }
  recommendations.push('Registrar coordenadas GPS exactas')
  recommendations.push('Tomar múltiples fotos desde diferentes ángulos')

  let className = 'desconocido'
  if (probability > 0.6) className = 'caliza'
  else if (probability > 0.35) className = 'posible_caliza'

  const isCarbonate = probability > 0.25
  const isDark = features.colorScore < 0.35
  const isClayLike = features.colorScore >= 0.35 && features.colorScore < 0.55

  const allProbabilities: Record<string, number> = {
    caliza: isCarbonate ? probability : 0,
    dolomita: isCarbonate ? Math.max(0, probability * 0.5) : 0,
    marga: isCarbonate ? Math.max(0, probability * 0.35) : 0,
    travertino: isCarbonate ? Math.max(0, probability * 0.2) : 0,
    caliche: isCarbonate ? Math.max(0, probability * 0.25) : 0,
    arcilla: isClayLike ? 0.5 : isDark ? 0.2 : 0.3,
    yeso: isClayLike ? 0.3 : 0.1,
    granito: isDark ? 0.4 : 0.1,
    basalto: isDark ? 0.5 : 0.05,
    desconocido: Math.max(0, 1 - probability),
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

    const lightness = avgBrightness / 255
    const desaturation = 1 - avgSaturation

    let colorScore = lightness * 0.6 + desaturation * 0.4
    colorScore = Math.max(0.1, Math.min(0.95, colorScore))

    const textureScore = 1 - brightnessVariance
    const granulometryScore = lightness > 0.5 ? 0.5 + lightness * 0.3 : 0.2 + lightness * 0.3
    const fractureScore = 0.2 + brightnessVariance * 0.6
    const veinScore = 0.15 + brightnessVariance * 0.5

    return {
      colorScore,
      textureScore,
      granulometryScore,
      fractureScore,
      veinScore,
    }
  } catch {
    return defaultScores()
  }
}

function defaultScores(): FeatureScores {
  return { colorScore: 0.5, textureScore: 0.5, granulometryScore: 0.5, fractureScore: 0.4, veinScore: 0.3 }
}

interface FeatureScores {
  colorScore: number
  textureScore: number
  granulometryScore: number
  fractureScore: number
  veinScore: number
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
