// convert start seconds + duration to hh:mm:ss-hh:mm:ss format
export function toVideoTimestamp(start: number, duration: number) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`
  }

  const startFormatted = formatTime(start)
  const endFormatted = formatTime(start + duration)

  return `${startFormatted}-${endFormatted}`
}
