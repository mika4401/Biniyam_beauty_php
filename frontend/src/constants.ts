/** Backend API base URL */
export const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'

export const EDU_LEVELS = ['Grade 6', 'Grade 8', 'Grade 10', 'Grade 12', 'Diploma', 'Degree', 'Masters', 'PhD'] as const

export const SCHEDULE_OPTIONS = [
  { value: 'weekday-morning', label: 'Monday to Friday, morning program, 2:30 AM – 6:30 AM' },
  { value: 'weekday-afternoon', label: 'Monday to Friday, afternoon program, 7:30 AM – 11:30 AM' },
  { value: 'weekday-midday', label: 'Monday to Friday, 11:00 AM – 1:30 PM' },
  { value: 'weekday-full', label: 'Monday to Friday, full day, 2:30 AM – 11:00 AM' },
  { value: 'weekend', label: 'Weekend program, Saturday and Sunday, 2:30 AM – 10:00 AM' },
] as const

/**
 * Company intro video shown in the About section.
 * After uploading the video to Cloudinary, paste its URL here
 * (e.g. https://res.cloudinary.com/<cloud-name>/video/upload/v1/beauty-academy/about-intro.mp4).
 * While empty, the About section falls back to the static image.
 */
export const ABOUT_VIDEO_URL = 'https://res.cloudinary.com/djzmclbg0/video/upload/v1786949988/video_2026-08-17_09-59-22_tloflw.mp4'

export const formatPrice = (price: number) => `${price.toLocaleString()} ETB`

export const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } }
