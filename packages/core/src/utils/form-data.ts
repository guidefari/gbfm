export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export function getFormFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return isFormDataFile(value) ? value : null
}

export function isFormDataFile(value: unknown): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value
}
