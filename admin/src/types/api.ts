/** Student record from the backend */
export interface Student {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  nationalId?: string
  nationalIdImage?: string
  educationLevel?: string
  fieldOfStudy?: string
  createdAt?: string
  updatedAt?: string
}

/** Program / course record from the backend */
export interface Program {
  _id: string
  id: string
  title: string
  description: string
  fullDescription?: string
  price: number
  duration: string
  image: string
  allowsHalfPayment: boolean
  isActive: boolean
  included: string[]
  discount?: string
  /** Amharic translations — optional, fall back to the English fields */
  titleAm?: string
  descriptionAm?: string
  fullDescriptionAm?: string
  durationAm?: string
  includedAm?: string[]
  slug?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

/** Registration record from the backend */
export interface Registration {
  _id: string
  student: Student | string
  programs: Program[] | string[]
  schedule: string
  paymentType: 'Full' | 'Half'
  status: 'Pending' | 'Paid' | 'Confirmed' | 'Cancelled'
  totalCost?: number
  amountPaid?: number
  createdAt?: string
  updatedAt?: string
}

/** Payment record from the backend */
export interface Payment {
  _id: string
  registration: string | Registration
  amount: number
  paymentType: 'Full' | 'Half'
  status: 'Pending' | 'Completed' | 'Failed' | 'Refunded'
  txRef?: string
  chapaCheckoutUrl?: string
  method?: string
  note?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

/** Stats summary from /registrations/stats/summary */
export interface RegistrationStats {
  total: number
  paidInFull: number
  halfPaid: number
  pending: number
  confirmed: number
  cancelled: number
  totalCollected: number
  programCounts: { _id: string; title: string; count: number }[]
}

/** Payment history for a single registration */
export interface RegistrationPayments {
  payments: Payment[]
  totalPaid: number
  paymentCount: number
}

/** Admin profile returned from login (matches backend auth response) */
export interface AdminProfile {
  id: string
  fullName: string
  email: string
  role?: string
}

/** Gallery image record from the backend */
export interface GalleryItem {
  _id: string
  imageUrl: string
  publicId: string
  caption: string
  category: string
  createdAt?: string
  updatedAt?: string
}

/** Cloudinary account usage for the quota display */
export interface GalleryUsage {
  plan: string
  usedPercent: number
  creditsUsed: number
  creditsLimit: number
  storageBytes: number
  atLimit: boolean
}

/** Pagination metadata returned by list endpoints */
export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  pagination?: Pagination
  accessToken?: string
  refreshToken?: string
  admin?: AdminProfile
}
