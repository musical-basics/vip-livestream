const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

function normalizeYouTubeVideoId(value: string | null | undefined) {
  const id = value?.trim() ?? ''
  return YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : ''
}

export function extractYouTubeVideoId(input: string) {
  const value = input.trim()
  if (!value) return ''

  const directId = normalizeYouTubeVideoId(value)
  if (directId) {
    return directId
  }

  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return normalizeYouTubeVideoId(url.pathname.split('/').filter(Boolean)[0])
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const watchId = url.searchParams.get('v')
      if (watchId) return normalizeYouTubeVideoId(watchId)

      const [kind, id] = url.pathname.split('/').filter(Boolean)
      if (['live', 'shorts', 'embed'].includes(kind) && id) {
        return normalizeYouTubeVideoId(id)
      }
    }
  } catch {
    return ''
  }

  return ''
}
