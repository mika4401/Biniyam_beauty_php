import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { ABOUT_VIDEO_URL } from '../constants'
import { useLanguage } from '../i18n/LanguageContext'

export function AboutVideo() {
  const { t } = useLanguage()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const poster = 'https://res.cloudinary.com/djzmclbg0/image/upload/v1787681529/image_ban_geqb53.avif'

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          video.muted = true
          void video.play().catch(() => { /* autoplay blocked — poster play button remains */ })
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ink">
      <video
        ref={videoRef}
        src={ABOUT_VIDEO_URL}
        poster={poster}
        muted
        playsInline
        controls={started}
        preload="metadata"
        className="h-full w-full object-cover"
        onPlay={() => setStarted(true)}
      />
      {!started && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current
            if (!video) return
            video.muted = false
            void video.play()
          }}
          aria-label={t('about.watchStory')}
          className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/40"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gold text-white shadow-[0_10px_30px_rgba(0,0,0,.25)] transition hover:scale-105 md:h-20 md:w-20">
            <Play size={26} fill="currentColor" className="ml-0.5" />
          </span>
        </button>
      )}
    </div>
  )
}
