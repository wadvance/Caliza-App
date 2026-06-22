import { View, Image, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native'
import { COLORS } from '../types/constants'

interface Props {
  photos: string[]
  onAddPhoto?: () => void
  onRemovePhoto?: (index: number) => void
  readonly?: boolean
}

export function PhotoGrid({ photos, onAddPhoto, onRemovePhoto, readonly }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {photos.map((uri, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri }} style={styles.photo} />
            {!readonly && onRemovePhoto && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemovePhoto(index)}
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {!readonly && onAddPhoto && (
          <TouchableOpacity style={styles.addBtn} onPress={onAddPhoto}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addLabel}>Foto</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scroll: {
    gap: 8,
    paddingHorizontal: 16,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  addBtn: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  addIcon: {
    color: COLORS.textSecondary,
    fontSize: 28,
  },
  addLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
})
