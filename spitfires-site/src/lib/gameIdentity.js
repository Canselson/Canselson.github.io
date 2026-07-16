// Pseudonymous per-browser identity for the Spitfiredle leaderboard.
// No login exists for site visitors, so a random device id (persisted in
// localStorage) stands in for "the same person" across days.
const DEVICE_KEY = 'spitfiredle-device-id'
const NAME_KEY = 'spitfiredle-display-name'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) || ''
}

export function saveDisplayName(name) {
  localStorage.setItem(NAME_KEY, name)
}
