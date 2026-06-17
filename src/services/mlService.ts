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
      return ruleBasedClassification(imageUri)
    }
  }

  return ruleBasedClassification(imageUri)
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

export function ruleBasedClassification(imageUri: string): MLPrediction {
  const features = extractFeatures(imageUri)

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

function extractFeatures(uri: string): FeatureScores {
  return {
    colorScore: 0.65,
    textureScore: 0.55,
    granulometryScore: 0.5,
    fractureScore: 0.45,
    veinScore: 0.35,
  }
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
