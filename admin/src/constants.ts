export const EDU_LEVELS = ['Grade 6', 'Grade 8', 'Grade 10', 'Grade 12', 'Diploma', 'Degree', 'Masters', 'PhD'] as const

export const SCHEDULE_OPTIONS = [
  { value: 'weekday-morning', label: 'Monday to Friday, morning program, 2:30 AM – 6:30 AM' },
  { value: 'weekday-afternoon', label: 'Monday to Friday, afternoon program, 7:30 AM – 11:30 AM' },
  { value: 'weekday-midday', label: 'Monday to Friday, 11:00 AM – 1:30 PM' },
  { value: 'weekday-full', label: 'Monday to Friday, full day, 2:30 AM – 11:00 AM' },
  { value: 'weekend', label: 'Weekend program, Saturday and Sunday, 2:30 AM – 10:00 AM' },
] as const
