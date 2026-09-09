import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { AcademyProvider } from './context/AcademyContext'
import { CartProvider } from './context/CartContext'
import { ScrollManager } from './components/ScrollManager'
import { HomePage } from './pages/HomePage'
import { AboutPage } from './pages/AboutPage'
import { GalleryPage } from './pages/GalleryPage'
import { ProgramDetailPage } from './pages/ProgramDetailPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { PaymentResultPage } from './pages/PaymentResultPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return <LanguageProvider>
    <BrowserRouter>
      <ScrollManager />
      <AcademyProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/programs/:id" element={<ProgramDetailPage />} />
            <Route path="/register" element={<CheckoutPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/success" element={<PaymentResultPage />} />
            <Route path="/payment/result" element={<PaymentResultPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </CartProvider>
      </AcademyProvider>
    </BrowserRouter>
  </LanguageProvider>
}

export default App
