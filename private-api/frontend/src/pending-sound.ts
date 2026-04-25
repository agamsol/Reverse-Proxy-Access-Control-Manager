const PENDING_NEW_SOUND_URL = `${import.meta.env.BASE_URL}pending-new.mp3`

let audio: HTMLAudioElement | null = null
let unlocked = false

/**
 * Call from a user gesture (click, submit, pointerdown). Browsers block
 * `Audio.play()` until the document has been activated; a 0-volume play
 * unlocks the element for later polls.
 */
export function primePendingNotificationSound() {
  if (typeof window === 'undefined' || unlocked) return
  if (!audio) {
    audio = new Audio(PENDING_NEW_SOUND_URL)
    audio.preload = 'auto'
  }
  const a = audio
  const savedVol = a.volume
  a.volume = 0
  void a
    .play()
    .then(() => {
      a.pause()
      a.currentTime = 0
      a.volume = savedVol
      unlocked = true
    })
    .catch(() => {
      a.volume = savedVol
    })
}

export function playNewPendingConnectionSound() {
  if (typeof window === 'undefined' || !unlocked || !audio) return
  audio.currentTime = 0
  void audio.play().catch(() => {})
}

export function resetPendingNotificationSound() {
  unlocked = false
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
}
