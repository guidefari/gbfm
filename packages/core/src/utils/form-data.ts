export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return value === null || value instanceof File ? '' : value
}

export function getFormFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return value instanceof File ? value : null
}
