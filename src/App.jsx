import React, { Suspense, lazy, useState } from 'react';
import { LazyMotion } from 'framer-motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Formats from './components/Formats';
import Events from './components/Events';
import Founder from './components/Founder';
import Residents from './components/Residents';
import Community from './components/Community';
import Gallery from './components/Gallery';
import Reviews from './components/Reviews';
import Footer from './components/Footer';
import Metrika from './components/Metrika';
import { KabinetProvider } from './kabinet/KabinetContext';
import PanelKabineta from './kabinet/PanelKabineta';

// Окно бронирования — самая тяжёлая часть сайта, а видит его лишь тот, кто нажал
// «забронировать». Раньше оно ехало на телефон вместе с главной страницей и
// запускалось наравне с ней, отнимая время у того, что человек видит сразу.
// Теперь подгружается по нажатию — за долю секунды, на уже открытом сайте.
const BookingModal = lazy(() => import('./components/BookingModal'));

// Окно входа в управление нужно одной заказчице и один раз за посещение.
// Гостям оно не приезжает вовсе — подгружается только по нажатию кнопки.
const VhodModal = lazy(() => import('./kabinet/VhodModal'));

function App() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pokazatVhod, setPokazatVhod] = useState(false);

  // Возможности анимаций подгружаются отдельно и следом за страницей, а не
  // вместе с ней. Строгий режим не даст случайно вернуть тяжёлый вариант:
  // если где-то останется старый <motion.*>, сборка сразу об этом скажет.
  return (
    <KabinetProvider>
    <LazyMotion features={() => import('./lib/animacii').then((m) => m.default)} strict>
    <div className="bg-poet-dark min-h-screen">
      <Navbar onUpravlenie={() => setPokazatVhod(true)} />
      <Hero />
      <About />
      <Formats />
      <Events onBook={(event) => setSelectedEvent(event)} />
      <Founder />
      <Residents />
      <Community />
      <Gallery />
      <Reviews />
      <Footer />

      {/* Пока окно не понадобилось, здесь нет ничего — ни разметки, ни кода. */}
      {selectedEvent && (
        <Suspense fallback={null}>
          <BookingModal
            event={selectedEvent}
            isOpen={!!selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        </Suspense>
      )}

      {pokazatVhod && (
        <Suspense fallback={null}>
          <VhodModal onClose={() => setPokazatVhod(false)} />
        </Suspense>
      )}

      <PanelKabineta />

      <Metrika />
    </div>
    </LazyMotion>
    </KabinetProvider>
  );
}

export default App;
