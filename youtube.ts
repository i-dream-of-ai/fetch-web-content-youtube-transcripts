// https://github.com/Kakulukian/youtube-transcript/blob/ff08036a45f47005cf7278724e83baeffaae4e7d/src/index.ts#L1

import { gotScraping } from "got-scraping"

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)"
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g

export class YoutubeTranscriptError extends Error {
  constructor(message: string) {
    super(`[YoutubeTranscript] 🚨 ${message}`)
  }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super(
      "YouTube is receiving too many requests from this IP and now requires solving a captcha to continue"
    )
  }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`)
  }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`)
  }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`)
  }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
        ", "
      )}`
    )
  }
}

export interface TranscriptConfig {
  lang?: string
}
interface TranscriptLine {
  text: string
  duration: number
  offset: number
  lang?: string
}

interface TranscriptResponse {
  title: string
  lines: TranscriptLine[]
}

/**
 * Class to retrieve transcript if exist
 */
export class YoutubeTranscript {
  /**
   * Fetch transcript from YTB Video
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  public static async fetchTranscript(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse> {
    const videoPageResponse = await gotScraping(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        throwHttpErrors: true,
        headers: {
          ...(config?.lang && { "Accept-Language": config.lang }),
          "User-Agent": USER_AGENT,
        },
      }
    )

    const videoPageBody = videoPageResponse.body

    const title = videoPageBody.match(/<title>(.*)<\/title>/)?.[1] || "unknown"
    const splittedHTML = videoPageBody.split('"captions":')

    if (splittedHTML.length <= 1) {
      if (videoPageBody.includes('class="g-recaptcha"')) {
        throw new YoutubeTranscriptTooManyRequestError()
      }
      if (!videoPageBody.includes('"playabilityStatus":')) {
        throw new YoutubeTranscriptVideoUnavailableError(videoId)
      }
      throw new YoutubeTranscriptDisabledError(videoId)
    }

    const captions: any = (() => {
      try {
        return JSON.parse(
          splittedHTML[1].split(',"videoDetails')[0].replace("\n", "")
        )
      } catch (e) {
        return undefined
      }
    })()?.["playerCaptionsTracklistRenderer"]

    if (!captions) {
      throw new YoutubeTranscriptDisabledError(videoId)
    }

    if (!("captionTracks" in captions)) {
      throw new YoutubeTranscriptNotAvailableError(videoId)
    }

    if (
      config?.lang &&
      !captions.captionTracks.some(
        (track: any) => track.languageCode === config?.lang
      )
    ) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        config?.lang,
        captions.captionTracks.map((track: any) => track.languageCode),
        videoId
      )
    }

    const transcriptURL = (
      config?.lang
        ? captions.captionTracks.find(
            (track: any) => track.languageCode === config?.lang
          )
        : captions.captionTracks[0]
    ).baseUrl

    const transcriptResponse = await fetch(transcriptURL, {
      headers: {
        ...(config?.lang && { "Accept-Language": config.lang }),
        "User-Agent": USER_AGENT,
      },
    })
    if (!transcriptResponse.ok) {
      throw new YoutubeTranscriptNotAvailableError(videoId)
    }
    const transcriptBody = await transcriptResponse.text()
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)]
    return {
      title,
      lines: results.map((result) => ({
        text: result[3],
        duration: parseFloat(result[2]),
        offset: parseFloat(result[1]),
        lang: config?.lang ?? captions.captionTracks[0].languageCode,
      })),
    }
  }

  /**
   * Retrieve video id from url or string
   * @param input
   */
  public static retrieveVideoId(input: string) {
    const matchId = input.match(RE_YOUTUBE)
    if (matchId && matchId.length) {
      return matchId[1]
    }
    return null
  }
}
