export interface Registration { id: string; name: string; email: string; phone: string; program: string; schedule: string; status: 'Pending' | 'Paid' }

export const registrations: Registration[] = [
  { id: 'r-101', name: 'Hana Bekele', email: 'hana@example.com', phone: '+251 91 234 5678', program: 'Professional Makeup Artistry', schedule: 'Weekend', status: 'Pending' },
  { id: 'r-102', name: 'Mahi Tesfaye', email: 'mahi@example.com', phone: '+251 92 345 6789', program: 'Advanced Hair Styling', schedule: 'Weekday', status: 'Paid' },
  { id: 'r-103', name: 'Liya Alemu', email: 'liya@example.com', phone: '+251 93 456 7890', program: 'Nail Technology', schedule: 'Night', status: 'Pending' },
]
