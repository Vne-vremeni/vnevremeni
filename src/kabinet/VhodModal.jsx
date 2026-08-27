/**
 * Окно входа в кабинет.
 *
 * Нарочно простое: одно поле и одна кнопка. Заказчица заходит сюда с телефона,
 * иногда в дороге, — чем меньше на экране, тем меньше поводов ошибиться.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useKabinet } from './KabinetContext';

export default function VhodModal({ onClose }) {
  const { vojti } = useKabinet();
  const [parol, setParol] = useState('');
  const [zanyato, setZanyato] = useState(false);
  const [oshibka, setOshibka] = useState('');
  const poleRef = useRef(null);

  // Курсор сразу в поле: на телефоне это лишнее касание, которого можно избежать.
  useEffect(() => {
    poleRef.current?.focus();
  }, []);

  useEffect(() => {
    const naKlavishu = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', naKlavishu);
    return () => window.removeEventListener('keydown', naKlavishu);
  }, [onClose]);

  const otpravit = async (e) => {
    e.preventDefault();
    if (zanyato) return;

    setZanyato(true);
    setOshibka('');
    try {
      await vojti(parol);
      onClose();
    } catch (e) {
      setOshibka(e.message);
      setParol('');
      poleRef.current?.focus();
    } finally {
      setZanyato(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Вход в управление сайтом"
    >
      <div
        className="glass-card w-full max-w-sm p-6 sm:p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-serif font-bold text-white mb-2">Управление сайтом</h2>
        <p className="text-poet-muted text-sm mb-6">Введите пароль, чтобы редактировать страницы.</p>

        <form onSubmit={otpravit}>
          <label htmlFor="kabinet-parol" className="block text-xs uppercase tracking-wider text-poet-muted mb-2">
            Пароль
          </label>
          <input
            id="kabinet-parol"
            ref={poleRef}
            type="password"
            value={parol}
            onChange={(e) => setParol(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-black/40 border border-white/10 focus:border-poet-accent rounded px-4 py-3 text-white outline-none transition-colors mb-4"
          />

          {oshibka && (
            <p role="alert" className="text-red-400 text-sm mb-4 leading-relaxed">{oshibka}</p>
          )}

          <button
            type="submit"
            disabled={zanyato || !parol}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {zanyato && <Loader2 className="w-4 h-4 animate-spin" />}
            {zanyato ? 'Проверяем…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
