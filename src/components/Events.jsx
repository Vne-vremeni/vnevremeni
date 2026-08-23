import React, { useEffect, useMemo, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, Info, X } from 'lucide-react';
// Файл лежит объектом с ключом events, а не голым списком: этого требует
// личный кабинет — он умеет править только именованные поля файла.
import eventsData from '../data/events.json';

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const formatDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

// Событие остаётся в афише до конца своего дня и исчезает само на следующий день.
// Так заказчице не нужно вручную убирать прошедшие вечера.
const isUpcoming = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59) >= new Date();
};

// Разметка афиши для поисковиков: события могут показаться в выдаче
// карточкой с датой и адресом, а не просто ссылкой на сайт.
const buildEventSchema = (events) => JSON.stringify(
  events.map(event => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: `${event.date}T${event.time || '19:00'}:00+03:00`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: event.description,
    location: {
      '@type': 'Place',
      name: event.venue,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address,
        addressLocality: 'Москва',
        addressCountry: 'RU'
      }
    },
    organizer: {
      '@type': 'Organization',
      name: 'Вне времени'
    },
    offers: {
      '@type': 'Offer',
      price: event.price,
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock'
    }
  }))
);

export default function Events({ onBook }) {
  const [poster, setPoster] = useState(null);

  const upcoming = useMemo(
    // hidden — временно снятый с публикации вечер: данные остаются в файле
    // нетронутыми, снять пометку можно в любой момент без набора заново.
    () => (eventsData.events || []).filter(item => isUpcoming(item.date) && !item.hidden).sort((a, b) => a.date.localeCompare(b.date)),
    []
  );

  useEffect(() => {
    if (!poster) return;
    const onKey = (e) => { if (e.key === 'Escape') setPoster(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poster]);

  return (
    <section id="events" className="py-24 bg-poet-dark relative">
      {upcoming.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildEventSchema(upcoming) }} />
      )}
      <div className="container mx-auto px-4 md:px-8">
        <div className="max-w-2xl mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
            Ближайшие <span className="text-poet-accent italic">события</span>
          </h2>
          <p className="text-poet-muted text-lg">
            Афиша наших встреч. Количество мест ограничено.
          </p>
        </div>

        {upcoming.length === 0 ? (
          <div className="glass-card p-10 text-center max-w-2xl">
            <p className="text-poet-light/80 text-lg mb-2">Афиша на новые вечера готовится.</p>
            <p className="text-poet-muted text-sm">
              Даты появятся здесь и в наших соцсетях — загляните чуть позже.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.map((event, index) => (
              <m.article
                key={event.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: Math.min(index, 2) * 0.1 }}
                className="glass-card overflow-hidden flex flex-col md:flex-row"
              >
                <div className="md:w-[38%] lg:w-[32%] shrink-0 bg-black/40 flex items-center justify-center p-4 sm:p-6">
                  <button
                    type="button"
                    onClick={() => setPoster(event)}
                    className="group relative rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-poet-accent"
                    title="Открыть афишу крупнее"
                  >
                    <img
                      src={event.poster}
                      alt={event.posterAlt}
                      loading="lazy"
                      className="max-h-[420px] w-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white/90 text-xs py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Открыть афишу крупнее
                    </span>
                  </button>
                </div>

                <div className="p-6 sm:p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl lg:text-3xl font-serif font-bold text-white mb-1">{event.title}</h3>
                  {event.subtitle && (
                    <p className="text-poet-accent text-sm mb-5">{event.subtitle}</p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm text-poet-light/80">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-poet-accent shrink-0" />
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-poet-accent shrink-0" />
                      <span>
                        начало в {event.time}
                        {event.gathering && `, сбор с ${event.gathering}`}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="w-4 h-4 text-poet-accent shrink-0 mt-0.5" />
                      <span>
                        {event.venue}, {event.address}
                        {event.metro && <span className="text-poet-muted"> · м. {event.metro}</span>}
                      </span>
                    </div>
                  </div>

                  <p className="text-poet-muted text-sm leading-relaxed mb-5">{event.description}</p>

                  {event.lineup?.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-poet-muted mb-2">
                        <Users className="w-3.5 h-3.5 text-poet-accent" />
                        Участники
                      </div>
                      <ul className="text-sm text-poet-light/80 space-y-1">
                        {event.lineup.map(line => (
                          <li key={line} className="leading-relaxed">{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {event.note && (
                    <p className="flex items-start gap-2 text-xs text-poet-muted mb-6">
                      <Info className="w-3.5 h-3.5 text-poet-accent shrink-0 mt-0.5" />
                      <span>{event.note}</span>
                    </p>
                  )}

                  <div className="mt-auto flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                    <div className="text-white">
                      <span className="text-2xl font-serif font-bold">{event.price.toLocaleString('ru-RU')} ₽</span>
                      <span className="text-poet-muted text-sm"> / билет</span>
                    </div>
                    <button
                      onClick={() => onBook(event)}
                      className="sm:ml-auto px-8 py-3 border border-white/10 hover:border-poet-accent text-white hover:text-poet-accent bg-white/5 hover:bg-poet-accent/10 transition rounded text-sm font-medium uppercase tracking-wider"
                    >
                      Купить билет
                    </button>
                  </div>
                </div>
              </m.article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {poster && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Афиша: ${poster.title}`}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPoster(null)}
          >
            <button
              onClick={() => setPoster(null)}
              aria-label="Закрыть афишу"
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={poster.poster}
              alt={poster.posterAlt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-full w-auto object-contain rounded-lg shadow-2xl"
            />
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
