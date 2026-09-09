import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '../i18n/LanguageContext'
import { API_BASE, fadeUp } from '../constants'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

interface GalleryItem {
  _id: string
  imageUrl: string
  publicId: string
  caption: string
  category: string
}

export function GalleryPage() {
  const { t } = useLanguage()
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery`)
        const data = await res.json()
        if (!cancelled) {
          if (data.success && Array.isArray(data.data)) {
            setItems(data.data)
          } else {
            setError(true)
          }
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return <><Navbar />
    <main>
      <section className="relative flex min-h-[420px] items-center overflow-hidden bg-ink pt-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=2000&q=90')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/55" />
        <motion.div {...fadeUp} className="relative mx-auto w-full max-w-7xl px-6 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('galleryPage.eyebrow')}</p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-tight text-white md:text-6xl">{t('galleryPage.title')}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/85">{t('galleryPage.paragraph')}</p>
        </motion.div>
      </section>
      <section className="bg-surface px-6 py-16 md:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          {error ? (
            <p className="py-16 text-center leading-7 text-muted">{t('galleryPage.error')}</p>
          ) : !items ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <motion.div key={index} {...fadeUp} className="animate-pulse overflow-hidden rounded-[20px] bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                  <div className="aspect-[4/3] w-full bg-surface" />
                  <div className="space-y-3 p-6">
                    <div className="h-4 w-3/4 rounded-full bg-surface" />
                    <div className="h-3 w-1/3 rounded-full bg-surface" />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center leading-7 text-muted">{t('galleryPage.empty')}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <motion.article key={item._id} {...fadeUp} className="overflow-hidden rounded-[20px] bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={item.imageUrl} alt={item.caption} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-6">
                    <p className="min-w-0 truncate font-display text-lg font-bold text-charcoal">{item.caption}</p>
                    <span className="shrink-0 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">{item.category}</span>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
    <Footer />
  </>
}
