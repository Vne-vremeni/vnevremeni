/**
 * Правка одного резидента.
 *
 * Устроено так же, как правка вечера (RedaktorVechera.jsx): все поля в одном
 * окне, подписаны обычными словами, кнопка «Сохранить» всегда на виду.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import { zagruzitFoto } from './api';

/** Пустой резидент — с ним открывается окно, когда добавляют нового. */
export const PUSTOJ_REZIDENT = {
  name: '',
  hidden: false,
  role: '',
  image: '',
  imageFocus: '30%',
  bio: '',
  socials: [],
};

/** Какие соцсети умеет показывать сайт (иконки — в components/SocialIcons.jsx). */
const SOCSETI = [
  { value: 'tg', label: 'Telegram' },
  { value: 'ig', label: 'Instagram' },
  { value: 'yt', label: 'YouTube' },
  { value: 'vk', label: 'ВКонтакте' },
  { value: 'stihi', label: 'Стихи.ру' },
  { value: 'site', label: 'Личный сайт' },
];

const Pole = ({ podpis, poyasnenie, children }) => (
  <div className="mb-5">
    <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">{podpis}</label>
    {children}
    {poyasnenie && <p className="text-poet-muted/70 text-xs mt-1.5 leading-relaxed">{poyasnenie}</p>}
  </div>
);

const stilPolya = 'w-full bg-black/40 border border-white/10 focus:border-poet-accent rounded px-3 py-2.5 text-white text-sm outline-none transition-colors';

/** '30%' → 30. Всё непонятное — к обычным 30. */
const chisloFokusa = (fokus) => {
  const chislo = parseInt(fokus, 10);
  return Number.isFinite(chislo) ? Math.min(100, Math.max(0, chislo)) : 30;
};

export default function RedaktorRezidenta({ rezident, novyj, onSohranit, onUdalit, onClose }) {
  const [dannye, setDannye] = useState(() => ({
    ...PUSTOJ_REZIDENT,
    ...rezident,
    socials: (rezident?.socials || []).map(s => ({ ...s })),
  }));
  const [zanyato, setZanyato] = useState(false);
  const [gruzitsyaFoto, setGruzitsyaFoto] = useState(false);
  const [oshibka, setOshibka] = useState('');
  const [podtverzhdenieUdaleniya, setPodtverzhdenie] = useState(false);
  const fajlRef = useRef(null);

  useEffect(() => {
    const naKlavishu = (e) => { if (e.key === 'Escape' && !zanyato) onClose(); };
    window.addEventListener('keydown', naKlavishu);
    return () => window.removeEventListener('keydown', naKlavishu);
  }, [onClose, zanyato]);

  const pomenyat = (klyuch, znachenie) => {
    setDannye((prezhnee) => ({ ...prezhnee, [klyuch]: znachenie }));
  };

  // ---- Ссылки на соцсети ---------------------------------------------------
  const pomenyatSsylku = (nomer, klyuch, znachenie) => {
    setDannye((p) => {
      const spisok = [...p.socials];
      spisok[nomer] = { ...spisok[nomer], [klyuch]: znachenie };
      return { ...p, socials: spisok };
    });
  };

  const ubratSsylku = (nomer) => {
    setDannye((p) => ({ ...p, socials: p.socials.filter((_, i) => i !== nomer) }));
  };

  const dobavitSsylku = () => {
    setDannye((p) => ({ ...p, socials: [...p.socials, { type: 'tg', url: '' }] }));
  };

  // ---- Фотография ----------------------------------------------------------
  const vybratFoto = async (e) => {
    const fajl = e.target.files?.[0];
    if (!fajl) return;

    setGruzitsyaFoto(true);
    setOshibka('');
    try {
      const otvet = await zagruzitFoto(fajl, 'rezident');
      pomenyat('image', otvet.put);
    } catch (err) {
      setOshibka(err.message);
    } finally {
      setGruzitsyaFoto(false);
      if (fajlRef.current) fajlRef.current.value = '';
    }
  };

  // ---- Сохранение ----------------------------------------------------------
  const sohranit = async () => {
    if (zanyato) return;

    if (!dannye.name.trim()) {
      setOshibka('Впишите имя резидента.');
      return;
    }
    if (!dannye.image) {
      setOshibka('Загрузите фотографию — без неё карточка на сайте будет пустой.');
      return;
    }

    // Пустые строчки ссылок молча убираем: скорее всего, их добавили и передумали.
    const ssylki = dannye.socials
      .map(s => ({ ...s, url: s.url.trim() }))
      .filter(s => s.url !== '');
    const plohaya = ssylki.find(s => !/^https?:\/\/\S+$/i.test(s.url));
    if (plohaya) {
      setOshibka(`Ссылка «${plohaya.url}» должна начинаться с https:// — скопируйте её из адресной строки целиком.`);
      return;
    }

    setZanyato(true);
    setOshibka('');
    try {
      await onSohranit({ ...dannye, socials: ssylki });
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
      await onUdalit();
      onClose();
    } catch (err) {
      setOshibka(err.message);
      setZanyato(false);
    }
  };

  const fokus = chisloFokusa(dannye.imageFocus);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={novyj ? 'Новый резидент' : 'Правка резидента'}
    >
      {/* my-auto, а не центрирование рамкой: длинное окно при центрировании
          уезжает верхом за край экрана, и до кнопки «Сохранить» не докрутить.
          overflow-visible — иначе шапка с кнопками не держится наверху. */}
      <div className="glass-card !overflow-visible w-full max-w-2xl my-0 sm:my-auto h-fit relative">

        <div className="sticky top-0 z-10 bg-poet-card/95 border-b border-white/10 px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <h2 className="text-lg sm:text-xl font-serif font-bold text-white">
            {novyj ? 'Новый резидент' : 'Правка резидента'}
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
                  Снимите галочку, чтобы временно убрать резидента с сайта. Всё, что
                  вписано, останется здесь — вернуть можно в любой момент.
                </span>
              </span>
            </label>
          </div>

          <Pole podpis="Имя" poyasnenie="Так, как человека называют на сцене.">
            <input
              type="text"
              value={dannye.name}
              onChange={(e) => pomenyat('name', e.target.value)}
              placeholder="Натали"
              className={stilPolya}
            />
          </Pole>

          <Pole podpis="Кто это" poyasnenie="Короткая строчка под именем.">
            <input
              type="text"
              value={dannye.role}
              onChange={(e) => pomenyat('role', e.target.value)}
              placeholder="поэт, резидент клуба"
              className={stilPolya}
            />
          </Pole>

          {/* Фотография и положение лица */}
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">Фотография</label>
            <div className="flex items-start gap-4">
              {/* Превью в тех же пропорциях, что карточка на сайте: сразу видно,
                  как ляжет кадр и не срезана ли макушка. */}
              <div className="w-28 aspect-[3/4] shrink-0 rounded border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
                {dannye.image ? (
                  <img
                    src={dannye.image}
                    alt=""
                    style={{ objectPosition: `center ${fokus}%` }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/20" />
                )}
              </div>
              <div className="flex-grow min-w-0">
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
                  Лучше вертикальный портрет, где человек занимает большую часть
                  высоты. Подойдёт фото прямо с телефона — сайт сам его уменьшит.
                </p>
              </div>
            </div>

            {dannye.image && (
              <div className="mt-4">
                <label className="block text-xs text-poet-muted mb-2">
                  Сдвинуть кадр: выше ← → ниже
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fokus}
                  onChange={(e) => pomenyat('imageFocus', `${e.target.value}%`)}
                  aria-label="Положение лица в кадре"
                  className="w-full accent-poet-accent"
                />
                <p className="text-poet-muted/70 text-xs mt-1 leading-relaxed">
                  Если на превью срезана макушка — двигайте влево. Если сверху много
                  пустого места — вправо.
                </p>
              </div>
            )}
          </div>

          <Pole podpis="Рассказ о человеке" poyasnenie="Пустая строка между абзацами разделит текст на абзацы и на сайте.">
            <textarea
              rows={8}
              value={dannye.bio}
              onChange={(e) => pomenyat('bio', e.target.value)}
              className={`${stilPolya} resize-y leading-relaxed`}
            />
          </Pole>

          {/* Соцсети */}
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wider text-poet-muted mb-2">Ссылки на соцсети</label>
            {dannye.socials.length === 0 && (
              <p className="text-poet-muted/70 text-xs mb-2">Пока нет. Можно не заполнять.</p>
            )}
            {dannye.socials.map((ssylka, nomer) => (
              <div key={nomer} className="flex flex-col sm:flex-row gap-2 mb-3">
                <select
                  value={ssylka.type}
                  onChange={(e) => pomenyatSsylku(nomer, 'type', e.target.value)}
                  aria-label={`Где ссылка ${nomer + 1}`}
                  className={`${stilPolya} sm:w-40 shrink-0`}
                >
                  {SOCSETI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div className="flex gap-2 flex-grow">
                  <input
                    type="url"
                    inputMode="url"
                    value={ssylka.url}
                    onChange={(e) => pomenyatSsylku(nomer, 'url', e.target.value)}
                    placeholder="https://t.me/…"
                    className={stilPolya}
                  />
                  <button
                    type="button"
                    onClick={() => ubratSsylku(nomer)}
                    aria-label={`Убрать ссылку ${nomer + 1}`}
                    className="shrink-0 px-3 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={dobavitSsylku}
              className="text-poet-accent text-sm flex items-center gap-1.5 hover:text-poet-accent/80 transition-colors mt-1"
            >
              <Plus className="w-4 h-4" /> Добавить ссылку
            </button>
          </div>

          {/* Удаление — внизу, отдельно, в два шага */}
          {!novyj && (
            <div className="mt-8 pt-6 border-t border-white/10">
              {!podtverzhdenieUdaleniya ? (
                <button
                  type="button"
                  onClick={() => setPodtverzhdenie(true)}
                  className="text-red-400/70 hover:text-red-400 text-sm flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Удалить резидента насовсем
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                  <p className="text-white text-sm mb-1">Удалить этого резидента?</p>
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
