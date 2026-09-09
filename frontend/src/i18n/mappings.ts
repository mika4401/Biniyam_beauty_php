/** Program id → translation key prefix (backend slug). Falls back to raw data for unknown ids. */
export const PROGRAM_I18N: Record<string, string> = {
  'professional-makeup': 'data.program.professional-makeup',
  'advanced-hair': 'data.program.advanced-hair',
  'nail-technology': 'data.program.nail-technology',
  'skincare-facial': 'data.program.skincare-facial',
  'lash-brow': 'data.program.lash-brow',
  'mens-special-class': 'data.program.mens-special-class',
  'mens-hair-normal': 'data.program.mens-hair-normal',
  'womens-hair': 'data.program.womens-hair',
  'braid': 'data.program.braid',
}

/** Testimonial name → translation key prefix. Falls back to raw data for unknown names. */
export const TESTIMONIAL_I18N: Record<string, string> = {
  'Marta Gebre': 'data.testimonial.marta',
  'Selamawit Tadesse': 'data.testimonial.selamawit',
  'Rahel Mekonnen': 'data.testimonial.rahel',
}

/** Raw validator error → translation key. Falls back to the raw error when unknown. */
export const VALIDATION_ERRORS: Record<string, string> = {
  'This field is required.': 'validation.fieldRequired',
  'Please remove unsupported characters or unsafe content.': 'validation.unsafeContent',
  'Full name must be between 3 and 30 characters.': 'validation.nameLength',
  'Full name may contain letters and single spaces only.': 'validation.nameLetters',
  'Email address is required.': 'validation.emailRequired',
  'Enter a valid email address.': 'validation.emailInvalid',
  'Please use a .com email address.': 'validation.emailDotCom',
  'Enter a valid phone number.': 'validation.phoneInvalid',
  'A URL is required.': 'validation.urlRequired',
  'Use an http, https, mailto, or tel URL.': 'validation.urlProtocol',
  'Enter a valid URL.': 'validation.urlInvalid',
}
