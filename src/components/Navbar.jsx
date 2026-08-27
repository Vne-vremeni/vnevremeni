import React, { useState, useEffect } from 'react';
import { Menu, X, Settings } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useKabinet } from '../kabinet/KabinetContext';

export default function Navbar({ onUpravlenie }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { voshel } = useKabinet();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Афиша', href: '#events' },
    { name: 'О клубе', href: '#about' },
    { name: 'Резиденты', href: '#residents' },
    { name: 'Галерея', href: '#gallery' },
    { name: 'Отзывы', href: '#reviews' },
    { name: 'Контакты', href: '#contacts' },
  ];

  return (
    // Шапка закреплена сверху и перерисовывается на каждом кадре прокрутки.
    // «Матового стекла» здесь быть не должно: подложка и так закрывает фон
    // на 95%, размытия не видно, а телефон из-за него пересчитывает картинку
    // под шапкой всю дорогу, пока человек листает страницу.
    <header className={`fixed top-0 left-0 right-0 z-50 transition duration-300 ${isScrolled ? 'bg-poet-dark/95 py-4 border-b border-white/5' : 'bg-transparent py-6'}`}>
      <div className="container mx-auto px-4 md:px-8 flex justify-between items-center">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <img src="./images/logo.webp" alt="Логотип клуба «Вне времени»" className="w-11 h-11 object-contain group-hover:scale-105 transition-transform" />
          <span className="font-serif text-xl md:text-2xl font-bold tracking-wider text-poet-light">ВНЕ ВРЕМЕНИ</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-8 items-center">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-sm font-medium text-poet-muted hover:text-poet-accent transition-colors">
              {link.name}
            </a>
          ))}
          {/* Вход для хозяйки сайта. Когда она уже вошла, кнопка не нужна:
              управление живёт в плашке внизу экрана. */}
          {!voshel && (
            <button
              type="button"
              onClick={onUpravlenie}
              className="text-sm font-medium text-poet-muted/60 hover:text-poet-accent transition-colors flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              Управление сайтом
            </button>
          )}
        </nav>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-poet-light" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <m.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-full left-0 right-0 bg-poet-dark/95 border-b border-white/5 py-4 px-4 flex flex-col gap-4 shadow-2xl"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-poet-light hover:text-poet-accent p-2"
              >
                {link.name}
              </a>
            ))}
            {!voshel && (
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onUpravlenie(); }}
                className="text-base font-medium text-poet-muted/70 hover:text-poet-accent p-2 flex items-center gap-2 border-t border-white/5 pt-4 mt-1"
              >
                <Settings className="w-4 h-4" />
                Управление сайтом
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
