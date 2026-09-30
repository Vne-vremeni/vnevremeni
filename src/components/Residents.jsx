import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Pencil, Plus, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { SocialLinks } from './SocialIcons';
import { useKabinet } from '../kabinet/KabinetContext';
import RedaktorRezidenta, { PUSTOJ_REZIDENT } from '../kabinet/RedaktorRezidenta';

export default function Residents() {
  const [selectedResident, setSelectedResident] = useState(null);
  // Резиденты приходят из кабинета: сначала копия из сборки, затем свежие с сервера.
  const { rezidenty, rezhimPravki, sohranitRezidentov } = useKabinet();
  // Кого правим: { nomer, rezident }. nomer = -1 — новый резидент.
  const [pravim, setPravim] = useState(null);
  const [peremeshaem, setPeremeshaem] = useState(false);

  // Номер в полном списке нужен, чтобы при правке заменить именно эту запись:
  // имена могут совпасть, а порядок — нет.
  const vse = (rezidenty || []).map((rezident, nomer) => ({ rezident, nomer }));
  const residents = rezhimPravki ? vse : vse.filter(({ rezident }) => !rezident.hidden);

  const sohranitRezidenta = async (rezident) => {
    const spisok = [...(rezidenty || [])];
    if (pravim.nomer >= 0) spisok[pravim.nomer] = rezident;
    else spisok.push(rezident);
    await sohranitRezidentov(spisok);
  };

  const udalitRezidenta = async () => {
    await sohranitRezidentov((rezidenty || []).filter((_, i) => i !== pravim.nomer));
  };

  // Порядок на сайте = порядок в списке. Сдвиг сохраняется сразу.
  const sdvinut = async (nomer, kuda) => {
    const drugoj = nomer + kuda;
    if (peremeshaem || drugoj < 0 || drugoj >= rezidenty.length) return;
    const spisok = [...rezidenty];
    [spisok[nomer], spisok[drugoj]] = [spisok[drugoj], spisok[nomer]];
    setPeremeshaem(true);
    try {
      await sohranitRezidentov(spisok);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setPeremeshaem(false);
    }
  };

  return (
    <section id="residents" className="py-24 bg-poet-dark relative">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">Наши <span className="text-poet-accent italic">резиденты</span></h2>
          <p className="text-poet-muted text-lg max-w-2xl mx-auto">Душа и голос клуба. Те, кто создает атмосферу каждого вечера.</p>
        </div>

        {rezhimPravki && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setPravim({ nomer: -1, rezident: { ...PUSTOJ_REZIDENT } })}
              className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Добавить резидента
            </button>
            <p className="text-poet-muted text-xs leading-relaxed max-w-md">
              Стрелки на карточке меняют порядок. Скрытых резидентов видите только вы.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          {residents.map(({ rezident: resident, nomer }, index) => (
            <m.div
              key={`${nomer}-${resident.name}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className={`group relative overflow-hidden rounded-lg aspect-[3/4] cursor-pointer ${
                rezhimPravki && resident.hidden ? 'opacity-60' : ''
              }`}
              onClick={() => setSelectedResident(resident)}
            >
              {/* Кнопки правки поверх карточки, всегда на виду — на телефоне
                  навести мышь нечем. Нажатие не должно открывать карточку. */}
              {rezhimPravki && (
                <div className="absolute top-2 left-2 right-2 z-20 flex items-start justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => sdvinut(nomer, -1)}
                      disabled={peremeshaem || nomer === 0}
                      aria-label={`Поставить «${resident.name}» раньше`}
                      className="bg-poet-dark/90 border border-white/15 rounded p-1.5 text-white hover:text-poet-accent disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => sdvinut(nomer, 1)}
                      disabled={peremeshaem || nomer === rezidenty.length - 1}
                      aria-label={`Поставить «${resident.name}» позже`}
                      className="bg-poet-dark/90 border border-white/15 rounded p-1.5 text-white hover:text-poet-accent disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setPravim({ nomer, rezident: resident })}
                      aria-label={`Править резидента «${resident.name}»`}
                      className="flex items-center gap-1.5 bg-poet-accent text-poet-dark rounded px-2.5 py-1.5 text-xs font-medium hover:bg-poet-accent/85 transition-colors shadow-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Править
                    </button>
                    {resident.hidden && (
                      <span className="flex items-center gap-1 bg-poet-dark/90 border border-white/15 rounded px-2 py-1 text-xs text-poet-muted">
                        <EyeOff className="w-3 h-3" /> скрыт
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Кадры сняты по-разному: где-то человек стоит выше, где-то ниже. Одна общая
                  точка обрезки одним срезала бы макушку, другим оставляла пустой потолок,
                  поэтому у каждого снимка своя — imageFocus в residents.json.
                  Обесцвечивание только там, где есть мышь: на сенсорном экране навести нечем,
                  и фото так и осталось бы серым. */}
              <img
                src={resident.image}
                alt={resident.name}
                style={{ objectPosition: `center ${resident.imageFocus || '30%'}` }}
                className="w-full h-full object-cover [@media(hover:hover)]:grayscale [@media(hover:hover)]:opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition duration-700 transform group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-poet-dark via-poet-dark/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

              <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <h4 className="text-xl font-serif font-bold text-white mb-1 group-hover:text-poet-accent transition-colors">{resident.name}</h4>
                <p className="text-xs text-poet-accent leading-snug mb-2">{resident.role}</p>
                <p className="text-xs text-poet-light/70 uppercase tracking-widest flex items-center gap-2">
                  Подробнее <span className="text-poet-accent">→</span>
                </p>
              </div>
            </m.div>
          ))}
        </div>
      </div>

      {/* Resident Modal */}
      <AnimatePresence>
        {selectedResident && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResident(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <m.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-poet-card border border-white/10 rounded-xl shadow-2xl max-w-4xl w-full relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              <button
                onClick={() => setSelectedResident(null)}
                className="absolute top-4 right-4 text-white hover:text-poet-accent bg-black/50 p-2 rounded-full transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* На телефоне под фото отводилась полоса в 256 пикселей — от вертикального
                  портрета оставалась середина лица. Отдаём кадру нормальную высоту. */}
              <div className="w-full md:w-2/5 aspect-[4/5] md:aspect-auto md:h-auto shrink-0 relative">
                <img
                  src={selectedResident.image}
                  alt={selectedResident.name}
                  style={{ objectPosition: `center ${selectedResident.imageFocus || '30%'}` }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-poet-card to-transparent md:hidden" />
              </div>

              <div className="w-full md:w-3/5 min-h-0 p-6 sm:p-8 md:p-10 overflow-y-auto">
                <h3 className="text-3xl font-serif font-bold text-white mb-2 pr-12">{selectedResident.name}</h3>
                <p className="text-sm text-poet-accent mb-4">{selectedResident.role}</p>
                <div className="w-12 h-1 bg-poet-accent rounded mb-6" />

                <p className="text-poet-light/90 leading-relaxed font-serif text-sm whitespace-pre-line">
                  {selectedResident.bio}
                </p>

                <SocialLinks links={selectedResident.socials} size="md" className="mt-8" />
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {pravim && (
        <RedaktorRezidenta
          rezident={pravim.rezident}
          novyj={pravim.nomer < 0}
          onSohranit={sohranitRezidenta}
          onUdalit={udalitRezidenta}
          onClose={() => setPravim(null)}
        />
      )}
    </section>
  );
}
