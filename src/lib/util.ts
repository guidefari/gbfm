export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text)
  } catch (error) {
    console.warn('Failed to copy text: ', error)
  }
}
