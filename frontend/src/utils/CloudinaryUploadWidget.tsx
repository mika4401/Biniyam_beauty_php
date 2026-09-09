import { useEffect, useRef, useState } from 'react'
import { Upload, Loader } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

interface CloudinaryWidgetResult {
  event: string
  info: {
    secure_url: string
    public_id: string
    format: string
    bytes: number
  }
}

interface CloudinaryWidget {
  open: () => void
  close: () => void
  destroy: () => void
}

interface CloudinarySDK {
  createUploadWidget: (
    config: Record<string, unknown>,
    callback: (error: unknown, result: CloudinaryWidgetResult) => void
  ) => CloudinaryWidget
}

declare global {
  interface Window {
    cloudinary?: CloudinarySDK
  }
}

interface Props {
  onUploadSuccess: (url: string) => void
  error?: string
}

interface CloudinaryConfig {
  cloudName: string
  uploadPreset: string
}

const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'

/**
 * Fetches Cloudinary configuration from the backend.
 * Falls back gracefully if the backend is unreachable or unconfigured.
 */
async function fetchCloudinaryConfig(): Promise<CloudinaryConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/cloudinary/config`)
    const body = await res.json()
    if (body.success && body.configured && body.data) {
      return body.data as CloudinaryConfig
    }
    console.warn('[Cloudinary] Not configured:', body.message)
    return null
  } catch {
    console.warn('[Cloudinary] Failed to fetch config — backend unreachable')
    return null
  }
}

/**
 * Cloudinary Upload Widget button.
 *
 * Fetches config from backend on mount, then opens the widget modal on click.
 * Calls `onUploadSuccess` with the secure URL when an upload completes.
 */
export default function CloudinaryUploadWidget({ onUploadSuccess, error }: Props) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const widgetRef = useRef<CloudinaryWidget | null>(null)
  const cloudinaryRef = useRef<CloudinarySDK | null>(null)
  const onUploadSuccessRef = useRef(onUploadSuccess)

  // Keep callback ref fresh without re-initializing the widget
  useEffect(() => {
    onUploadSuccessRef.current = onUploadSuccess
  }, [onUploadSuccess])

  // Fetch config and create the widget once on mount
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const cfg = await fetchCloudinaryConfig()
      if (cancelled) return

      if (!cfg) {
        setLoading(false)
        setFetchError(t('checkout.uploadUnavailable'))
        return
      }

      // Wait for the Cloudinary script to be available
      const checkCloudinary = () => {
        if (window.cloudinary) {
          cloudinaryRef.current = window.cloudinary
          widgetRef.current = window.cloudinary.createUploadWidget(
            {
              cloudName: cfg.cloudName,
              uploadPreset: cfg.uploadPreset,
              sources: ['local', 'camera'],
              multiple: false,
              maxFileSize: 5_000_000, // 5 MB
              clientAllowedFormats: ['png', 'jpg', 'jpeg', 'pdf', 'gif'],
              maxImageFileSize: 5_000_000,
              folder: 'beauty-academy/national-ids',
              styles: {
                palette: {
                  window: '#FFFFFF',
                  windowBorder: '#C8A044',
                  tabIcon: '#C8A044',
                  menuIcons: '#C8A044',
                  textDark: '#222222',
                  textLight: '#FFFFFF',
                  link: '#C8A044',
                  action: '#C8A044',
                  inactiveTabIcon: '#6B7280',
                  error: '#EF4444',
                  inProgress: '#C8A044',
                  complete: '#22C55E',
                  sourceBg: '#FAFAFA',
                },
              },
            },
            (error: unknown, result: CloudinaryWidgetResult) => {
              if (!error && result && result.event === 'success') {
                onUploadSuccessRef.current(result.info.secure_url)
              }
            }
          )
          setLoading(false)
        } else {
          // Retry after a short delay if script hasn't loaded yet
          setTimeout(checkCloudinary, 500)
        }
      }

      checkCloudinary()
    }

    init()

    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 bg-card px-4 py-5 text-sm text-muted">
        <Loader size={20} className="animate-spin" />
        <span>{t('checkout.uploadLoading')}</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="mt-2 rounded-xl border-2 border-dashed border-danger/30 bg-danger/5 px-4 py-5 text-sm text-muted">
        <p className="flex items-center gap-2">
          <Upload size={20} className="text-danger" />
          <span className="text-danger font-medium">{t('checkout.uploadRequired')}</span>
        </p>
        <p className="mt-2 text-xs text-muted">{t('checkout.uploadRequiredHint')}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setFetchError('')
            fetchCloudinaryConfig().then((cfg) => {
              if (cfg && window.cloudinary) {
                cloudinaryRef.current = window.cloudinary
                widgetRef.current = window.cloudinary.createUploadWidget(
                  {
                    cloudName: cfg.cloudName,
                    uploadPreset: cfg.uploadPreset,
                    sources: ['local', 'camera'],
                    multiple: false,
                    maxFileSize: 5_000_000,
                    clientAllowedFormats: ['png', 'jpg', 'jpeg', 'pdf', 'gif'],
                    maxImageFileSize: 5_000_000,
                    folder: 'beauty-academy/national-ids',
                    styles: {
                      palette: {
                        window: '#FFFFFF',
                        windowBorder: '#C8A044',
                        tabIcon: '#C8A044',
                        menuIcons: '#C8A044',
                        textDark: '#222222',
                        textLight: '#FFFFFF',
                        link: '#C8A044',
                        action: '#C8A044',
                        inactiveTabIcon: '#6B7280',
                        error: '#EF4444',
                        inProgress: '#C8A044',
                        complete: '#22C55E',
                        sourceBg: '#FAFAFA',
                      },
                    },
                  },
                  (error: unknown, result: CloudinaryWidgetResult) => {
                    if (!error && result && result.event === 'success') {
                      onUploadSuccessRef.current(result.info.secure_url)
                    }
                  }
                )
                setLoading(false)
              } else {
                setLoading(false)
                setFetchError(t('checkout.uploadUnavailable'))
              }
            })
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold bg-gold/10 px-4 py-2 text-xs font-semibold text-gold transition hover:bg-gold hover:text-white"
        >
          {t('checkout.uploadRetry')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => widgetRef.current?.open()}
        className={`mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition ${error ? 'border-danger bg-danger/5' : 'border-black/20 dark:border-white/20 bg-card hover:border-gold'}`}
      >
        <Upload size={20} className={error ? 'text-danger' : 'text-gold'} />
        <span className="text-muted">{t('checkout.uploadClick')}</span>
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
