import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, HardDrive, Loader, Trash2, Upload, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchGalleryItems, createGalleryItem, deleteGalleryItem, fetchGalleryUsage } from '../utils/api'
import type { GalleryItem, GalleryUsage } from '../types/api'
import { fadeUp } from '../utils/helpers'

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(bytes >= Math.pow(1024, 3) ? 2 : 0)} ${units[i]}`
}

export function GalleryView() {
  const { t } = useLanguage()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<GalleryUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchGalleryItems()
      if (res.success && res.data) setItems(res.data)
    } catch { setError(t('gallery.error.load')) }
    finally { setLoading(false) }
  }, [t])

  const loadUsage = useCallback(async () => {
    setUsageLoading(true)
    try {
      const res = await fetchGalleryUsage()
      if (res.success && res.data) setUsage(res.data)
    } catch { /* non-fatal — usage display only */ }
    finally { setUsageLoading(false) }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems()
    loadUsage()
  }, [loadItems, loadUsage])

  const handleDelete = async (item: GalleryItem) => {
    if (!window.confirm(t('gallery.deleteConfirm').replace('{caption}', item.caption))) return
    setDeletingId(item._id)
    setError('')
    setActionMsg('')
    try {
      const res = await deleteGalleryItem(item._id)
      if (res.success) {
        setItems((current) => current.filter((i) => i._id !== item._id))
        setActionMsg(t('gallery.deleted'))
        setTimeout(() => setActionMsg(''), 3000)
      } else {
        setError(res.message || t('gallery.error.delete'))
      }
    } catch { setError(t('gallery.error.deleteGeneric')) }
    finally { setDeletingId(null) }
  }

  return (
    <section className="flex-1 px-6 py-8 md:px-12 md:py-12">
      <motion.header {...fadeUp} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('gallery.eyebrow')}</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-charcoal">{t('nav.gallery')}</h1>
          <p className="mt-3 text-sm text-muted">{t('gallery.subtitle')}</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
          <Upload size={18} />{t('gallery.upload')}
        </button>
      </motion.header>

      {/* Cloudinary usage banner — always visible */}
      <div className="mt-8 rounded-[20px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gold/15 text-gold"><HardDrive size={20} /></span>
            <div>
              <p className="text-sm font-semibold text-charcoal">{t('gallery.storageTitle')}</p>
              <p className="mt-0.5 text-xs text-muted">{usage ? t('gallery.monthlyCreditQuotaWithPlan').replace('{plan}', usage.plan) : t('gallery.monthlyCreditQuota')}</p>
            </div>
          </div>
          {usage ? (
            <div className="text-right">
              <p className={`font-display text-2xl font-bold ${usage.atLimit ? 'text-danger' : 'text-charcoal'}`}>{usage.usedPercent.toFixed(2)}%</p>
              <p className="text-xs text-muted">
                {usage.creditsUsed.toFixed(2)} / {usage.creditsLimit} {t('gallery.creditsUsed')}
                {usage.storageBytes > 0 ? ` · ${formatBytes(usage.storageBytes)}` : ''}
              </p>
            </div>
          ) : usageLoading ? (
            <Loader size={20} className="animate-spin text-gold" />
          ) : (
            <p className="text-xs text-muted">{t('gallery.usageUnavailable')}</p>
          )}
        </div>
        {usage && (
          <>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full transition-all duration-500 ${usage.atLimit ? 'bg-danger' : 'bg-gold'}`} style={{ width: `${Math.min(100, usage.usedPercent)}%` }} />
            </div>
            {usage.atLimit && (
              <p className="mt-4 flex items-start gap-2 rounded-[14px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{t('gallery.quotaWarning')}</span>
              </p>
            )}
          </>
        )}
      </div>

      {actionMsg && (
        <div className="mt-6 rounded-[14px] border border-success/30 bg-success/10 px-5 py-4 text-sm text-success">{actionMsg}</div>
      )}
      {error && <div role="alert" className="mt-6 rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">{error}</div>}

      {loading ? (
        <div className="mt-12 flex items-center justify-center"><Loader size={28} className="animate-spin text-gold" /></div>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-[20px] bg-white px-6 py-16 text-center text-sm text-muted shadow-[0_10px_30px_rgba(0,0,0,.08)]">
          {t('gallery.empty')}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <motion.div key={item._id} {...fadeUp} className="overflow-hidden rounded-[20px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.08)]">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.imageUrl} alt={item.caption} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-charcoal">{item.caption}</p>
                  <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold">{item.category}</span>
                </div>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item._id}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-danger/30 bg-white px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60">
                  {deletingId === item._id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}{t('gallery.delete')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <GalleryUploadModal
            onClose={() => setShowUpload(false)}
            onUploaded={() => { setShowUpload(false); loadItems() }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function GalleryUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { t } = useLanguage()
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    setError('')
    if (selected) {
      if (selected.size > 7 * 1024 * 1024) {
        setError(t('gallery.error.size'))
        setPreview('')
        setFile(null)
        e.target.value = ''
        return
      }
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(selected.type)) {
        setError(t('gallery.error.type'))
        setPreview('')
        setFile(null)
        e.target.value = ''
        return
      }
      const reader = new FileReader()
      reader.onload = () => setPreview(String(reader.result))
      reader.readAsDataURL(selected)
    } else {
      setPreview('')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !preview) { setError(t('gallery.error.noFile')); return }
    if (!caption.trim()) { setError(t('gallery.error.caption')); return }
    if (!category.trim()) { setError(t('gallery.error.category')); return }
    setSaving(true)
    setError('')
    try {
      const res = await createGalleryItem({ imageData: preview, caption: caption.trim(), category: category.trim() })
      if (res.success) {
        onUploaded()
      } else {
        setError(res.message || t('gallery.error.upload'))
      }
    } catch { setError(t('gallery.error.uploadGeneric')) }
    finally { setSaving(false) }
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-gold'
  const labelClass = 'text-sm font-medium text-charcoal'

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('nav.gallery')}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-charcoal">{t('gallery.upload')}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-charcoal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div>
            <label className={labelClass}>{t('gallery.imageLabel')}</label>
            {preview ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-black/10">
                <img src={preview} alt={t('gallery.preview')} className="aspect-[4/3] w-full object-cover" />
              </div>
            ) : (
              <label className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${error ? 'border-danger bg-danger/5' : 'border-black/20 bg-white hover:border-gold'}`}>
                <Upload size={28} className="text-gold" />
                <span className="text-sm text-muted">{t('gallery.chooseImage')}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
              </label>
            )}
            {preview && file && (
              <button type="button" onClick={() => { setPreview(''); setFile(null) }} className="mt-2 text-sm font-medium text-danger transition hover:underline">{t('gallery.removeImage')}</button>
            )}
          </div>

          <div>
            <label className={labelClass}>{t('gallery.captionLabel')}</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('gallery.captionPlaceholder')} maxLength={120} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>{t('gallery.categoryLabel')}</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('gallery.categoryPlaceholder')} maxLength={60} className={inputClass} />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <span className="inline-flex items-center gap-2"><Loader size={16} className="animate-spin" />{t('gallery.uploading')}</span> : t('gallery.upload')}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-[14px] border border-black/10 bg-white px-6 py-4 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
