import * as Location from 'expo-location'
import { useState, useEffect } from 'react'

export interface LocationData {
  latitude: number
  longitude: number
  altitude: number
  accuracy: number
  speed: number | null
  timestamp: number
}

let currentLocation: LocationData | null = null
let locationSubscription: Location.LocationSubscription | null = null
let watchers: Array<(loc: LocationData) => void> = []

export async function requestLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync()
  if (!foreground.granted) return false

  const background = await Location.requestBackgroundPermissionsAsync()
  return background.granted
}

export async function getCurrentLocation(): Promise<LocationData> {
  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  })

  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude: loc.coords.altitude ?? 0,
    accuracy: loc.coords.accuracy ?? 0,
    speed: loc.coords.speed,
    timestamp: loc.timestamp,
  }
}

export function startLocationTracking(): void {
  if (locationSubscription) return

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 5000,
    },
    (loc) => {
      const data: LocationData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude ?? 0,
        accuracy: loc.coords.accuracy ?? 0,
        speed: loc.coords.speed,
        timestamp: loc.timestamp,
      }
      currentLocation = data
      watchers.forEach(cb => cb(data))
    },
  ).then(sub => { locationSubscription = sub })
}

export function stopLocationTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove()
    locationSubscription = null
  }
}

export function getCurrentLocationSync(): LocationData | null {
  return currentLocation
}

export function onLocationChange(callback: (loc: LocationData) => void): () => void {
  watchers.push(callback)
  return () => {
    watchers = watchers.filter(cb => cb !== callback)
  }
}

export function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function calculateBearing(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  const latDeg = Math.abs(lat).toFixed(6)
  const lonDeg = Math.abs(lon).toFixed(6)
  return `${latDeg}° ${latDir}, ${lonDeg}° ${lonDir}`
}

export function useCurrentLocation(): LocationData | null {
  const [loc, setLoc] = useState<LocationData | null>(currentLocation)

  useEffect(() => {
    const unsub = onLocationChange(setLoc)
    if (!currentLocation) {
      getCurrentLocation().then(setLoc)
    }
    return unsub
  }, [])

  return loc
}
