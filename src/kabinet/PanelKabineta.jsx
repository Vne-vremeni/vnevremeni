/**
 * Плашка управления: появляется внизу экрана, когда вошли в кабинет.
 *
 * Внизу, а не вверху, — чтобы не закрывать шапку сайта и быть под большим
 * пальцем на телефоне. Обычные гости её не видят никогда.
 */

import React, { useState } from 'react';
import { Pencil, Eye, LogOut, Loader2 } from 'lucide-react';
import { useKabinet } from './KabinetContext';

export default function PanelKabineta() {
  const { voshel, rezhimPravki, setRezhimPravki, vyjti } = useKabinet();
  const [vyhodit, setVyhodit] = useState(false);

  if (!voshel) return null;

  const nazhatVyhod = async () => {
    setVyhodit(true);
    try {
      await vyjti();
    } finally {
      setVyhodit(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] bg-poet-dark/95 border-t border-poet-accent/30 px-4 py-3 shadow-2xl">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <span className="text-poet-accent text-xs sm:text-sm font-medium">
          {rezhimPravki ? 'Режим правки' : 'Управление сайтом'}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRezhimPravki(!rezhimPravki)}
            className="flex items-center gap-2 px-4 py-2 rounded border border-poet-accent/40 bg-poet-accent/10 hover:bg-poet-accent/20 text-poet-accent text-sm transition-colors"
          >
            {rezhimPravki ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            <span className="hidden xs:inline sm:inline">
              {rezhimPravki ? 'Посмотреть как гость' : 'Править сайт'}
            </span>
            <span className="xs:hidden sm:hidden">{rezhimPravki ? 'Просмотр' : 'Править'}</span>
          </button>

          <button
            type="button"
            onClick={nazhatVyhod}
            disabled={vyhodit}
            aria-label="Выйти из управления сайтом"
            className="flex items-center gap-2 px-3 py-2 rounded border border-white/10 text-poet-muted hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            {vyhodit ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
