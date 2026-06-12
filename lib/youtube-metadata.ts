type YouTubeBroadcastStatus = 'live' | 'ended' | 'waiting' | 'unknown'

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number
  }
}

interface YouTubeMetadataOptions {
  cache?: RequestCache
  revalidate?: number
}

export interface YouTubeVideoMetadata {
  broadcastStatus: YouTubeBroadcastStatus
  durationSeconds: number | null
  title: string | null
  /** When the broadcast actually went on air (ISO 8601). Video time 0:00 of a
   *  finished live stream's replay corresponds to this wall-clock moment. */
  actualStartTime: string | null
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function getRecord(source: Record<string, unknown> | null, key: string) {
  return asRecord(source?.[key])
}

function getBoolean(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key]
  return typeof value === 'boolean' ? value : null
}

function getString(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key]
  return typeof value === 'string' ? value : null
}

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function extractAssignedJson(html: string, marker: string) {
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) return null

  const start = html.indexOf('{', markerIndex)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const char = html[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return html.slice(start, index + 1)
      }
    }
  }

  return null
}

function parsePlayerResponse(html: string) {
  const json = extractAssignedJson(html, 'ytInitialPlayerResponse')
  if (!json) return null

  try {
    return asRecord(JSON.parse(json))
  } catch {
    return null
  }
}

function getDurationSeconds(html: string, videoDetails: Record<string, unknown> | null) {
  const detailLength = parsePositiveInteger(getString(videoDetails, 'lengthSeconds'))
  if (detailLength !== null) return detailLength

  const lengthMatch = html.match(/"lengthSeconds":"?(\d+)"?/)
  if (lengthMatch?.[1]) return parsePositiveInteger(lengthMatch[1])

  const approxMatch = html.match(/"approxDurationMs":"?(\d+)"?/)
  if (approxMatch?.[1]) {
    const milliseconds = Number(approxMatch[1])
    return Number.isFinite(milliseconds) && milliseconds > 0
      ? Math.round(milliseconds / 1000)
      : null
  }

  return null
}

function getHtmlBoolean(html: string, key: string) {
  const match = html.match(new RegExp(`"${key}":(true|false)`))
  if (!match?.[1]) return null
  return match[1] === 'true'
}

function getHtmlString(html: string, key: string) {
  return html.match(new RegExp(`"${key}":"([^"]+)"`))?.[1] ?? null
}

function getBroadcastStatus(
  videoDetails: Record<string, unknown> | null,
  liveBroadcastDetails: Record<string, unknown> | null,
  playabilityStatus: string | null,
  durationSeconds: number | null,
  html: string
): YouTubeBroadcastStatus {
  const isLiveNow = getBoolean(liveBroadcastDetails, 'isLiveNow') ?? getHtmlBoolean(html, 'isLiveNow')
  const endTimestamp = getString(liveBroadcastDetails, 'endTimestamp') ?? getHtmlString(html, 'endTimestamp')
  const isLive = getBoolean(videoDetails, 'isLive')
  const isLiveContent = getBoolean(videoDetails, 'isLiveContent') ?? getHtmlBoolean(html, 'isLiveContent')

  if (endTimestamp || (isLiveContent === true && durationSeconds !== null)) return 'ended'
  if (isLiveNow === true || isLive === true) return 'live'
  if (isLiveNow === false || playabilityStatus === 'LIVE_STREAM_OFFLINE') return 'waiting'

  return 'unknown'
}

const UNKNOWN_METADATA: YouTubeVideoMetadata = {
  broadcastStatus: 'unknown',
  durationSeconds: null,
  title: null,
  actualStartTime: null,
}

function buildMetadata(playerResponse: Record<string, unknown> | null, html: string): YouTubeVideoMetadata {
  const videoDetails = getRecord(playerResponse, 'videoDetails')
  const microformat = getRecord(playerResponse, 'microformat')
  const playerMicroformat = getRecord(microformat, 'playerMicroformatRenderer')
  const liveBroadcastDetails = getRecord(playerMicroformat, 'liveBroadcastDetails')
  const playability = getRecord(playerResponse, 'playabilityStatus')
  const playabilityStatus = getString(playability, 'status')
  const durationSeconds = getDurationSeconds(html, videoDetails)

  return {
    broadcastStatus: getBroadcastStatus(
      videoDetails,
      liveBroadcastDetails,
      playabilityStatus,
      durationSeconds,
      html
    ),
    durationSeconds,
    title: getString(videoDetails, 'title'),
    actualStartTime:
      getString(liveBroadcastDetails, 'startTimestamp') ??
      (html ? getHtmlString(html, 'startTimestamp') : null),
  }
}

async function fetchViaWatchPage(
  videoId: string,
  options: YouTubeMetadataOptions
): Promise<YouTubeVideoMetadata> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const fetchOptions: NextFetchInit = {
      signal: controller.signal,
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (compatible; VIPLivestreamBot/1.0)',
      },
    }

    if (options.revalidate !== undefined) {
      fetchOptions.next = { revalidate: options.revalidate }
    } else {
      fetchOptions.cache = options.cache ?? 'no-store'
    }

    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, fetchOptions)
    clearTimeout(timeoutId)

    if (!res.ok) {
      return UNKNOWN_METADATA
    }

    const html = await res.text()
    return buildMetadata(parsePlayerResponse(html), html)
  } catch {
    return UNKNOWN_METADATA
  }
}

/**
 * The InnerTube player endpoint is the JSON API YouTube's own web client
 * calls. Unlike the watch-page HTML (which datacenter IPs — e.g. Vercel —
 * often get bot-walled on, hiding the player response), it reliably returns
 * broadcast details, so it backs up the scrape when that yields 'unknown'.
 */
async function fetchViaInnerTube(videoId: string): Promise<YouTubeVideoMetadata> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00' } },
        videoId,
      }),
      cache: 'no-store',
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return UNKNOWN_METADATA
    }

    return buildMetadata(asRecord(await res.json()), '')
  } catch {
    return UNKNOWN_METADATA
  }
}

export async function fetchYouTubeVideoMetadata(
  videoId: string,
  options: YouTubeMetadataOptions = {}
): Promise<YouTubeVideoMetadata> {
  const fromWatchPage = await fetchViaWatchPage(videoId, options)
  if (fromWatchPage.broadcastStatus !== 'unknown') {
    return fromWatchPage
  }

  const fromInnerTube = await fetchViaInnerTube(videoId)
  return fromInnerTube.broadcastStatus !== 'unknown' ? fromInnerTube : fromWatchPage
}
