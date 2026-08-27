/**
 * Кладёт копию данных сайта в сборку — как запасной ход для кабинета.
 *
 * Зачем. Кабинет хранит данные в отдельной папке на хостинге, вне сайта, чтобы
 * выкладка их не стирала. Но в самый первый раз этой папки ещё нет — кабинет
 * только поставили, править ничего не успели. Чтобы афиша при этом не оказалась
 * пустой, рядом со страницами лежит копия из сборки: с неё кабинет и начинает.
 *
 * Дальше эта копия остаётся лежать нетронутой и служит вторым запасным ходом —
 * если серверная часть однажды откажет, сайт покажет афишу из неё, а не пустое
 * место. Гость в любом случае увидит вечера.
 *
 * Запускается сам перед сборкой, руками вызывать не нужно.
 */

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const koren = join(dirname(fileURLToPath(import.meta.url)), '..');
const otkuda = join(koren, 'src', 'data');
const kuda = join(koren, 'public', 'dannye-iz-sborki');

mkdirSync(kuda, { recursive: true });

let skopirovano = 0;
for (const imya of readdirSync(otkuda)) {
  if (!imya.endsWith('.json')) continue;
  copyFileSync(join(otkuda, imya), join(kuda, imya));
  skopirovano++;
}

console.log(`Запасная копия данных: ${skopirovano} файл(ов) в public/dannye-iz-sborki/`);
