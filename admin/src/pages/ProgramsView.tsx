import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit3, Loader, Plus, Trash2, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchPrograms, updateProgram, createProgram, deleteProgram } from '../utils/api'
import type { Program } from '../types/api'
import { fadeUp, formatPrice } from '../utils/helpers'

interface ProgramFormData {
  title: string
  description: string
  fullDescription: string
  price: number
  duration: string
  image: string
  allowsHalfPayment: boolean
  isActive: boolean
  included: string[]
  titleAm: string
  descriptionAm: string
  fullDescriptionAm: string
  durationAm: string
  includedAm: string[]
}

export function ProgramsView() {
  const { t } = useLanguage()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editProgram, setEditProgram] = useState<Program | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPrograms()
      if (res.success && res.data) {
        setPrograms(res.data)
      }
    } catch { setError(t('programs.error.load')) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPrograms()
  }, [loadPrograms])

  const openEditor = (program: Program | null) => {
    setEditProgram(program)
    setIsCreating(!program)
    setShowEditor(true)
    setActionMsg('')
  }

  const closeEditor = () => {
    setShowEditor(false)
    setTimeout(() => { setEditProgram(null); setIsCreating(false) }, 200)
  }

  const handleSave = () => {
    closeEditor()
    loadPrograms()
    setActionMsg(isCreating ? t('programs.created') : t('programs.updated'))
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleDelete = async (program: Program) => {
    if (!window.confirm(t('programs.deleteConfirm').replace('{title}', program.title))) return
    setDeletingId(program._id)
    setError('')
    setActionMsg('')
    try {
      const res = await deleteProgram(program._id)
      if (res.success) {
        setPrograms((current) => current.filter((p) => p._id !== program._id))
        setActionMsg(t('programs.deleted'))
        setTimeout(() => setActionMsg(''), 3000)
      } else {
        setError(res.message || t('programs.error.delete'))
      }
    } catch { setError(t('messages.errorOccurred')) }
    finally { setDeletingId(null) }
  }

  return (
    <section className="flex-1 px-6 py-8 md:px-12 md:py-12">
      <motion.header {...fadeUp} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('programs.eyebrow')}</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-charcoal">{t('nav.programs')}</h1>
          <p className="mt-3 text-sm text-muted">{t('programs.subtitle')}</p>
        </div>
        <button onClick={() => openEditor(null)}
          className="inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
          <Plus size={18} />{t('programs.add')}
        </button>
      </motion.header>

      {actionMsg && (
        <div className="mt-6 rounded-[14px] border border-success/30 bg-success/10 px-5 py-4 text-sm text-success">
          {actionMsg}
        </div>
      )}

      {error && <div role="alert" className="mt-6 rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">{error}</div>}

      {loading ? (
        <div className="mt-12 flex items-center justify-center"><Loader size={28} className="animate-spin text-gold" /></div>
      ) : programs.length === 0 ? (
        <div className="mt-12 text-center text-sm text-muted">{t('programs.empty')}</div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => {
            const title = program.title
            const price = program.price
            const isActive = program.isActive
            const allowsHalf = program.allowsHalfPayment
            return (
              <motion.div key={program._id} {...fadeUp}
                className="overflow-hidden rounded-[20px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.08)] transition-all hover:-translate-y-0.5 hover:shadow-lg">
                {program.image && (
                  <div className="aspect-[16/9] overflow-hidden">
                    <img src={program.image} alt={title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-bold text-charcoal">{title}</h3>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${isActive ? 'bg-success/15 text-success' : 'bg-red-100 text-red-700'}`}>
                      {isActive ? t('programs.active') : t('programs.inactive')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted line-clamp-2">{program.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-charcoal">{formatPrice(price)}</p>
                      <p className="text-xs text-muted">{program.duration}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {allowsHalf && <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">{t('programs.halfOk')}</span>}
                    </div>
                  </div>
                  <button onClick={() => openEditor(program)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-gold bg-white px-4 py-3 text-sm font-semibold text-gold transition hover:-translate-y-0.5">
                    <Edit3 size={16} />{t('programs.edit')}
                  </button>
                  <button onClick={() => handleDelete(program)}
                    disabled={deletingId === program._id}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-danger/30 bg-white px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60">
                    {deletingId === program._id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}{t('programs.delete')}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Edit / Create modal */}
      <AnimatePresence>
        {showEditor && (
          <ProgramEditModal
            program={editProgram}
            isCreating={isCreating}
            onClose={closeEditor}
            onSaved={handleSave}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function ProgramEditModal({ program, isCreating, onClose, onSaved }: {
  program: Program | null
  isCreating: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<ProgramFormData>(() => ({
    title: (program?.title as string) || '',
    description: (program?.description as string) || '',
    fullDescription: (program?.fullDescription as string) || '',
    price: (program?.price as number) || 0,
    duration: (program?.duration as string) || '',
    image: (program?.image as string) || '',
    allowsHalfPayment: (program?.allowsHalfPayment as boolean) || false,
    isActive: program ? (program?.isActive) : true,
    included: ((program?.included as string[]) || ['']),
    titleAm: (program?.titleAm as string) || '',
    descriptionAm: (program?.descriptionAm as string) || '',
    fullDescriptionAm: (program?.fullDescriptionAm as string) || '',
    durationAm: (program?.durationAm as string) || '',
    includedAm: ((program?.includedAm as string[]) || ['']),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (field: keyof ProgramFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const setIncludedItem = (index: number, value: string) => {
    const updated = [...form.included]
    updated[index] = value
    setForm((prev) => ({ ...prev, included: updated }))
  }

  const addIncludedItem = () => {
    setForm((prev) => ({ ...prev, included: [...prev.included, ''] }))
  }

  const removeIncludedItem = (index: number) => {
    const updated = form.included.filter((_, i) => i !== index)
    setForm((prev) => ({ ...prev, included: updated.length > 0 ? updated : [''] }))
  }

  const setIncludedAmItem = (index: number, value: string) => {
    const updated = [...form.includedAm]
    updated[index] = value
    setForm((prev) => ({ ...prev, includedAm: updated }))
  }

  const addIncludedAmItem = () => {
    setForm((prev) => ({ ...prev, includedAm: [...prev.includedAm, ''] }))
  }

  const removeIncludedAmItem = (index: number) => {
    const updated = form.includedAm.filter((_, i) => i !== index)
    setForm((prev) => ({ ...prev, includedAm: updated.length > 0 ? updated : [''] }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim() || !form.price) {
      setError(t('programs.validation.required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        included: form.included.filter((i) => i.trim()),
        includedAm: form.includedAm.filter((i) => i.trim()),
      }
      const res = isCreating
        ? await createProgram(payload)
        : await updateProgram(program!._id, payload)
      if (res.success) {
        onSaved()
      } else {
        setError(res.message || t('programs.error.save'))
      }
    } catch { setError(t('messages.errorOccurred')) }
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
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{isCreating ? t('programs.new') : t('programs.edit')}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-charcoal">{isCreating ? t('programs.add') : form.title || t('programs.editProgram')}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-charcoal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <label className={labelClass}>{t('programs.titleLabel')}</label>
            <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder={t('programs.titlePlaceholder')} className={inputClass} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('programs.priceLabel')}</label>
              <input type="number" value={form.price || ''} onChange={(e) => setField('price', Number(e.target.value))} min={0} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('programs.durationLabel')}</label>
              <input value={form.duration} onChange={(e) => setField('duration', e.target.value)} placeholder={t('programs.durationPlaceholder')} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('programs.shortDescription')}</label>
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows={2} placeholder={t('programs.shortDescriptionPlaceholder')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>{t('programs.fullDescription')}</label>
            <textarea value={form.fullDescription} onChange={(e) => setField('fullDescription', e.target.value)} rows={3} placeholder={t('programs.fullDescriptionPlaceholder')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>{t('programs.imageUrl')}</label>
            <input value={form.image} onChange={(e) => setField('image', e.target.value)} placeholder="https://images.unsplash.com/..." className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>{t('programs.whatsIncluded')}</label>
            <div className="mt-2 space-y-2">
              {form.included.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={item} onChange={(e) => setIncludedItem(i, e.target.value)} placeholder={`${t('programs.item')} ${i + 1}`}
                    className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold" />
                  <button type="button" onClick={() => removeIncludedItem(i)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addIncludedItem}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gold transition hover:underline">
              <Plus size={14} />{t('programs.addItem')}
            </button>
          </div>

          {/* ── Amharic translation section ── */}
          <div className="rounded-2xl border border-black/10 bg-surface/60 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold">{t('programs.amharicSection')}</p>
            <p className="mt-1 text-xs text-muted">{t('programs.amharicHint')}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>{t('programs.titleAmLabel')}</label>
                <input value={form.titleAm} onChange={(e) => setField('titleAm', e.target.value)} placeholder={t('programs.titleAmPlaceholder')} className={inputClass} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('programs.durationAmLabel')}</label>
                  <input value={form.durationAm} onChange={(e) => setField('durationAm', e.target.value)} placeholder={t('programs.durationAmPlaceholder')} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>{t('programs.shortDescriptionAm')}</label>
                <textarea value={form.descriptionAm} onChange={(e) => setField('descriptionAm', e.target.value)} rows={2} placeholder={t('programs.shortDescriptionAmPlaceholder')} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>{t('programs.fullDescriptionAm')}</label>
                <textarea value={form.fullDescriptionAm} onChange={(e) => setField('fullDescriptionAm', e.target.value)} rows={3} placeholder={t('programs.fullDescriptionAmPlaceholder')} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>{t('programs.whatsIncludedAm')}</label>
                <div className="mt-2 space-y-2">
                  {form.includedAm.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={item} onChange={(e) => setIncludedAmItem(i, e.target.value)} placeholder={`${t('programs.item')} ${i + 1}`}
                        className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold" />
                      <button type="button" onClick={() => removeIncludedAmItem(i)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addIncludedAmItem}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gold transition hover:underline">
                  <Plus size={14} />{t('programs.addItem')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.allowsHalfPayment} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('allowsHalfPayment', e.target.checked)}
                className="h-4 w-4 accent-gold" />
              <span className="text-sm font-medium text-charcoal">{t('programs.allowHalfPayment')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.isActive} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('isActive', e.target.checked)}
                className="h-4 w-4 accent-gold" />
              <span className="text-sm font-medium text-charcoal">{t('programs.active')}</span>
            </label>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? t('programs.saving') : isCreating ? t('programs.create') : t('programs.save')}
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
