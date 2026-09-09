export interface Testimonial { name: string; role: string; quote: string; image: string; rating: number }

export const testimonials: Testimonial[] = [
  { name: 'Marta Gebre', role: 'Makeup Artist', quote: 'The feedback was detailed, practical, and helped me build a portfolio I am proud to show clients.', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=320&q=80', rating: 5 },
  { name: 'Selamawit Tadesse', role: 'Salon Stylist', quote: 'Every session felt intentional. I left with stronger technique and the confidence to work professionally.', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=320&q=80', rating: 5 },
  { name: 'Rahel Mekonnen', role: 'Nail Technician', quote: 'The small-group practice changed everything. I now know how to deliver services clients return for.', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80', rating: 5 },
]
