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

  if (features.colorScore > 0.7) {
    calizaScore += 0.3
    reasons.push('Color característico de carbonatos')
  }
  if (features.textureScore > 0.6) {
    calizaScore += 0.25
    reasons.push('Textura compatible con roca sedimentaria')
  }
  if (features.granulometryScore > 0.5) {
    calizaScore += 0.15
    reasons.push('Granulometría fina a media')
  }
  if (features.fractureScore > 0.4) {
    calizaScore += 0.1
    reasons.push('Patrón de fracturación presente')
  }
  if (features.veinScore > 0.3) {
    calizaScore += 0.1
    reasons.push('Posibles vetas de calcita')
  }

  const probability = Math.min(calizaScore, 0.95)

  const recommendations: string[] = []
  if (probability > 0.7) {
    recommendations.push('Alta probabilidad de caliza - validar con HCl')
  } else if (probability > 0.4) {
    recommendations.push('Probabilidad media - realizar prueba de dureza y ácido')
  } else {
    recommendations.push('Baja probabilidad - verificar visualmente otras características')
  }
  recommendations.push('Registrar coordenadas GPS exactas')
  recommendations.push('Tomar múltiples fotos desde diferentes ángulos')

  let className = 'desconocido'
  if (probability > 0.7) className = 'caliza'
  else if (probability > 0.5) className = 'posible_caliza'

  const allProbabilities: Record<string, number> = {
    caliza: probability,
    dolomita: Math.max(0, probability - 0.15),
    marga: Math.max(0, probability * 0.6),
    arcilla: Math.max(0, 1 - probability - 0.3),
    yeso: Math.max(0, 1 - probability - 0.5),
    travertino: Math.max(0, probability * 0.3),
    granito: Math.max(0, 1 - probability - 0.6),
    basalto: Math.max(0, 1 - probability - 0.7),
    caliche: Math.max(0, probability * 0.4),
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

    const isLight = avgBrightness > 160
    const isVeryLight = avgBrightness > 200
    const isDark = avgBrightness < 80
    const isDesaturated = avgSaturation < 0.15

    let colorScore = 0.5
    if (isVeryLight && isDesaturated) colorScore = 0.9
    else if (isLight && isDesaturated) colorScore = 0.75
    else if (isLight) colorScore = 0.6
    else if (isDark) colorScore = 0.15
    else if (avgSaturation > 0.3) colorScore = 0.3

    const textureScore = isDark ? 0.3 : Math.max(0.2, 1 - brightnessVariance)

    return {
      colorScore,
      textureScore,
      granulometryScore: isLight ? 0.6 : 0.3,
      fractureScore: brightnessVariance > 0.15 ? 0.5 : 0.3,
      veinScore: brightnessVariance > 0.2 ? 0.4 : 0.2,
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
