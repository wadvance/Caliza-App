import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { COLORS } from '../types/constants'

interface TextField {
  label: string
  key: string
  value: string
  type?: 'text' | 'number' | 'multiline'
}

interface SwitchField {
  label: string
  key: string
  value: boolean
  type: 'switch'
}

type Field = TextField | SwitchField

interface Props {
  title: string
  fields: Field[]
  onSave: (values: Record<string, string | boolean>) => void
  initialEdit?: boolean
}

export function EditableSection({ title, fields, onSave, initialEdit = false }: Props) {
  const [editing, setEditing] = useState(initialEdit)
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {}
    for (const f of fields) {
      init[f.key] = f.value
    }
    return init
  })

  const handleSave = () => {
    onSave(values)
    setEditing(false)
  }

  const handleCancel = () => {
    const init: Record<string, string | boolean> = {}
    for (const f of fields) {
      init[f.key] = f.value
    }
    setValues(init)
    setEditing(false)
  }

  const setFieldValue = (key: string, val: string | boolean) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {fields.map(f => (
        <View key={f.key} style={styles.field}>
          {f.type === 'switch' ? (
            <View style={styles.switchRow}>
              <Text style={styles.label}>{f.label}</Text>
              <Switch
                value={!!values[f.key]}
                onValueChange={v => setFieldValue(f.key, v)}
                disabled={!editing}
                trackColor={{ false: COLORS.border, true: COLORS.accent + '80' }}
                thumbColor={values[f.key] ? COLORS.accent : COLORS.textMuted}
              />
            </View>
          ) : (
            <>
              <Text style={styles.label}>{f.label}</Text>
              {editing ? (
                <TextInput
                  style={[
                    styles.input,
                    f.type === 'multiline' && styles.multiline,
                    f.type === 'number' && styles.numberInput,
                  ]}
                  value={String(values[f.key] ?? '')}
                  onChangeText={v => setFieldValue(f.key, v)}
                  multiline={f.type === 'multiline'}
                  numberOfLines={f.type === 'multiline' ? 3 : 1}
                  keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                  placeholderTextColor={COLORS.textMuted}
                />
              ) : (
                <Text style={[
                  styles.value,
                  !values[f.key] && styles.emptyValue,
                ]}>
                  {String(values[f.key] ?? '—') || '—'}
                </Text>
              )}
            </>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  editBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
  },
  saveBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  field: {
    marginBottom: 10,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyValue: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  input: {
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  numberInput: {
    fontFamily: 'monospace',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
})
