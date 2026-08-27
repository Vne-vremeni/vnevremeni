/**
 * Правка одного вечера афиши.
 *
 * Все поля собраны в одном окне и подписаны обычными словами, а не названиями
 * из кода: «Во сколько начало», а не «time». Заказчица не программист, и
 * догадываться, что куда, ей не нужно.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import { zagruzitFoto } from './api';

/** Пустой вечер — с ним открывается окно, когда добавляют новый. */
export const PUSTOJ_VECHER = {
  id: '',
  hidden: false,
  title: '',
  subtitle: '',
  date: '',
  time: '19:00',
  gathering: '',
  venue: '',
  address: '',
  metro: '',
  price: 0,
  note: '',
  description: '',
  lineup: [],
  poster: '',
  posterAlt: '',
};

const Pole = ({ podpis, poyasnenie, children }) => (
  <div className="mb-5">
    <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">{podpis}</label>
    {children}
    {poyasnenie && <p className="text-poet-muted/70 text-xs mt-1.5 leading-relaxed">{poyasnenie}</p>}
  </div>
);

const stilPolya = 'w-full bg-black/40 border border-white/10 focus:border-poet-accent rounded px-3 py-2.5 text-white text-sm outline-none transition-colors';

export default function RedaktorVechera({ vecher, onSohranit, onUdalit, onClose }) {
  const [dannye, setDannye] = useState(() => ({ ...PUSTOJ_VECHER, ...vecher }));
  const [zanyato, setZanyato] = useState(false);
  const [gruzitsyaFoto, setGruzitsyaFoto] = useState(false);
  const [oshibka, setOshibka] = useState('');
  const [podtverzhdenieUdaleniya, setPodtverzhdenie] = useState(false);
  const fajlRef = useRef(null);

  const novyj = !vecher?.id;

  useEffect(() => {
    const naKlavishu = (e) => { if (e.key === 'Escape' && !zanyato) onClose(); };
    window.addEventListener('keydown', naKlavishu);
    return () => window.removeEventListener('keydown', naKlavishu);
  }, [onClose, zanyato]);

  const pomenyat = (klyuch, znachenie) => {
    setDannye((prezhnee) => ({ ...prezhnee, [klyuch]: znachenie }));
  };

  // ---- Состав участников ---------------------------------------------------
  const pomenyatUchastnika = (nomer, tekst) => {
    setDannye((p) => {
      const spisok = [...p.lineup];
      spisok[nomer] = tekst;
      return { ...p, lineup: spisok };
    });
  };

  const ubratUchastnika = (nomer) => {
    setDannye((p) => ({ ...p, lineup: p.lineup.filter((_, i) => i !== nomer) }));
  };

  const dobavitUchastnika = () => {
    setDannye((p) => ({ ...p, lineup: [...p.lineup, ''] }));
  };

  // ---- Картинка афиши ------------------------------------------------------
  const vybratFoto = async (e) => {
    const fajl = e.target.files?.[0];
    if (!fajl) return;

    setGruzitsyaFoto(true);
    setOshibka('');
    try {
      const otvet = await zagruzitFoto(fajl);
      pomenyat('poster', otvet.put);
    } catch (err) {
      setOshibka(err.message);
    } finally {
      setGruzitsyaFoto(false);
      // Сбрасываем поле: иначе повторный выбор того же файла не сработает.
      if (fajlRef.current) fajlRef.current.value = '';
    }
  };

  // ---- Сохранение ----------------------------------------------------------
  const sohranit = async () => {
    if (zanyato) return;

    // Проверяем здесь же, до отправки: так заказчица видит, что именно
    // не заполнено, сразу, а не после ожидания ответа сервера.
    if (!dannye.title.trim()) {
      setOshibka('Впишите название вечера.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dannye.date)) {
      setOshibka('Выберите дату вечера.');
      return;
    }

    setZanyato(true);
    setOshibka('');
    try {
      await onSohranit(dannye);
      onClose();
    } catch (err) {
      setOshibka(err.message);
    } finally {
      setZanyato(false);
    }
  };

  const udalit = async () => {
    setZanyato(true);
    setOshibka('');
    try {
      await onUdalit(dannye.id);
      onClose();
    } catch (err) {
      setOshibka(err.message);
      setZanyato(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={novyj ? 'Новый вечер' : 'Правка вечера'}
    >
      <div className="glass-card w-full max-w-2xl my-0 sm:my-8 relative">

        {/* Шапка окна закреплена: на телефоне список полей длинный, и кнопки
            «Сохранить»/«Закрыть» не должны уезжать за край экрана. */}
        <div className="sticky top-0 z-10 bg-poet-card/95 border-b border-white/10 px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <h2 className="text-lg sm:text-xl font-serif font-bold text-white">
            {novyj ? 'Новый вечер' : 'Правка вечера'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sohranit}
              disabled={zanyato || gruzitsyaFoto}
              className="btn-primary text-sm px-5 py-2 flex items-center gap-2 disabled:opacity-50"
            >
              {zanyato && <Loader2 className="w-4 h-4 animate-spin" />}
              {zanyato ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={zanyato}
              aria-label="Закрыть без сохранения"
              className="text-white/50 hover:text-white transition-colors p-1 disabled:opacity-30"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-6">

          {oshibka && (
            <p role="alert" className="text-red-400 text-sm mb-5 leading-relaxed bg-red-500/10 border border-red-500/20 rounded p-3">
              {oshibka}
            </p>
          )}

          {/* Показывать или спрятать */}
          <div className="mb-6 p-4 rounded border border-white/10 bg-white/[0.02]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!dannye.hidden}
                onChange={(e) => pomenyat('hidden', !e.target.checked)}
                className="mt-1 w-4 h-4 accent-poet-accent shrink-0"
              />
              <span>
                <span className="text-white text-sm font-medium">Показывать на сайте</span>
                <span className="block text-poet-muted text-xs mt-1 leading-relaxed">
                  Снимите галочку, чтобы временно убрать вечер с сайта. Всё, что вы
                  вписали, останется здесь — вернуть можно в любой момент.
                </span>
              </span>
            </label>
          </div>

          <Pole podpis="Название вечера">
            <input
              type="text"
              value={dannye.title}
              onChange={(e) => pomenyat('title', e.target.value)}
              placeholder="Музыкально-поэтический вечер «Анестезия»"
              className={stilPolya}
            />
          </Pole>

          <Pole podpis="Подзаголовок" poyasnenie="Короткая строчка под названием. Можно оставить пустой.">
            <input
              type="text"
              value={dannye.subtitle}
              onChange={(e) => pomenyat('subtitle', e.target.value)}
              placeholder="Натали и DAYLY"
              className={stilPolya}
            />
          </Pole>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Pole podpis="Дата">
              <input
                type="date"
                value={dannye.date}
                onChange={(e) => pomenyat('date', e.target.value)}
                className={stilPolya}
              />
            </Pole>
            <Pole podpis="Начало">
              <input
                type="time"
                value={dannye.time}
                onChange={(e) => pomenyat('time', e.target.value)}
                className={stilPolya}
              />
            </Pole>
            <Pole podpis="Сбор гостей" poyasnenie="Не обязательно.">
              <input
                type="time"
                value={dannye.gathering}
                onChange={(e) => pomenyat('gathering', e.target.value)}
                className={stilPolya}
              />
            </Pole>
          </div>

          <Pole podpis="Место">
            <input
              type="text"
              value={dannye.venue}
              onChange={(e) => pomenyat('venue', e.target.value)}
              placeholder="Караоке-клуб «Матрёшка»"
              className={stilPolya}
            />
          </Pole>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Pole podpis="Адрес">
              <input
                type="text"
                value={dannye.address}
                onChange={(e) => pomenyat('address', e.target.value)}
                placeholder="Болотная набережная, 3, стр. 3"
                className={stilPolya}
              />
            </Pole>
            <Pole podpis="Метро">
              <input
                type="text"
                value={dannye.metro}
                onChange={(e) => pomenyat('metro', e.target.value)}
                placeholder="Полянка"
                className={stilPolya}
              />
            </Pole>
          </div>

          <Pole podpis="Цена билета, ₽">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={dannye.price}
              onChange={(e) => pomenyat('price', Number(e.target.value) || 0)}
              className={stilPolya}
            />
          </Pole>

          <Pole podpis="Описание" poyasnenie="Несколько предложений о вечере — их видят на карточке.">
            <textarea
              rows={5}
              value={dannye.description}
              onChange={(e) => pomenyat('description', e.target.value)}
              className={`${stilPolya} resize-y leading-relaxed`}
            />
          </Pole>

          <Pole podpis="Примечание" poyasnenie="Например: «Минимальный заказ в заведении — 1500 ₽». Можно оставить пустым.">
            <input
              type="text"
              value={dannye.note}
              onChange={(e) => pomenyat('note', e.target.value)}
              className={stilPolya}
            />
          </Pole>

          {/* Состав участников */}
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">Участники</label>
            {dannye.lineup.length === 0 && (
              <p className="text-poet-muted/70 text-xs mb-2">Пока никого. Можно не заполнять.</p>
            )}
            {dannye.lineup.map((uchastnik, nomer) => (
              <div key={nomer} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={uchastnik}
                  onChange={(e) => pomenyatUchastnika(nomer, e.target.value)}
                  placeholder="Имя участника"
                  className={stilPolya}
                />
                <button
                  type="button"
                  onClick={() => ubratUchastnika(nomer)}
                  aria-label={`Убрать участника ${nomer + 1}`}
                  className="shrink-0 px-3 text-white/40 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={dobavitUchastnika}
              className="text-poet-accent text-sm flex items-center gap-1.5 hover:text-poet-accent/80 transition-colors mt-1"
            >
              <Plus className="w-4 h-4" /> Добавить участника
            </button>
          </div>

          {/* Афиша */}
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">Афиша</label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-40 shrink-0 rounded border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
                {dannye.poster ? (
                  <img src={dannye.poster} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/20" />
                )}
              </div>
              <div className="flex-grow">
                <input
                  ref={fajlRef}
                  type="file"
                  accept="image/*"
                  onChange={vybratFoto}
                  disabled={gruzitsyaFoto}
                  className="block w-full text-sm text-poet-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-poet-accent/15 file:text-poet-accent hover:file:bg-poet-accent/25 file:cursor-pointer"
                />
                {gruzitsyaFoto && (
                  <p className="text-poet-accent text-xs mt-2 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Загружаем и сжимаем…
                  </p>
                )}
                <p className="text-poet-muted/70 text-xs mt-2 leading-relaxed">
                  Подойдёт фото прямо с телефона — сайт сам уменьшит его до нужного
                  размера. Прежняя афиша останется на сервере: если новая не
                  понравится, старую можно вернуть.
                </p>
              </div>
            </div>
          </div>

          <Pole
            podpis="Описание афиши"
            poyasnenie="Короткая фраза о том, что на картинке. Её читают вслух незрячим гостям и видят поисковики."
          >
            <input
              type="text"
              value={dannye.posterAlt}
              onChange={(e) => pomenyat('posterAlt', e.target.value)}
              placeholder="Афиша вечера «Анестезия»: Натали и DAYLY у микрофона"
              className={stilPolya}
            />
          </Pole>

          {/* Удаление — внизу, отдельно, в два шага */}
          {!novyj && (
            <div className="mt-8 pt-6 border-t border-white/10">
              {!podtverzhdenieUdaleniya ? (
                <button
                  type="button"
                  onClick={() => setPodtverzhdenie(true)}
                  className="text-red-400/70 hover:text-red-400 text-sm flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Удалить вечер насовсем
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                  <p className="text-white text-sm mb-1">Удалить этот вечер?</p>
                  <p className="text-poet-muted text-xs mb-4 leading-relaxed">
                    Если нужно просто убрать его с сайта на время — лучше снимите
                    галочку «Показывать на сайте» вверху: тогда всё написанное
                    сохранится.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={udalit}
                      disabled={zanyato}
                      className="px-4 py-2 rounded bg-red-500/80 hover:bg-red-500 text-white text-sm transition-colors disabled:opacity-50"
                    >
                      Да, удалить
                    </button>
                    <button
                      type="button"
                      onClick={() => setPodtverzhdenie(false)}
                      className="px-4 py-2 rounded border border-white/10 text-poet-muted hover:text-white text-sm transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
