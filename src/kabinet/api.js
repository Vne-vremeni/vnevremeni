/**
 * Разговор кабинета с сервером.
 *
 * Всё общение собрано здесь, а не разбросано по страницам: когда однажды
 * понадобится что-то поменять в обмене с сервером, менять придётся в одном месте.
 *
 * Никаких сторонних сервисов: только наш собственный хостинг. Прежний кабинет
 * ходил на чужие сервера, и именно это его и подводило — из России они то
 * доступны, то нет, и заказчица видела пустую страницу без объяснений.
 */

const API = './api';

/**
 * Ответ сервера в понятном виде.
 *
 * Сервер всегда отвечает JSON — но если он вдруг упал, вернётся страница с
 * ошибкой хостера, и разбор оборвётся. Такое тоже показываем по-человечески:
 * заказчица не должна видеть техническую тарабарщину.
 */
async function razobrat(otvet) {
  let dannye = null;
  try {
    dannye = await otvet.json();
  } catch {
    throw new Error('Сервер ответил непонятно. Попробуйте ещё раз через минуту.');
  }

  if (!otvet.ok || dannye?.ok === false) {
    throw new Error(dannye?.oshibka || 'Не получилось. Попробуйте ещё раз.');
  }

  return dannye;
}

/** Обёртка над запросом: обрыв связи тоже должен выглядеть по-человечески. */
async function poslat(adres, nastrojki = {}) {
  let otvet;
  try {
    otvet = await fetch(adres, { credentials: 'same-origin', ...nastrojki });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте снова.');
  }
  return razobrat(otvet);
}

/** Вошёл ли посетитель в кабинет. Спрашивается один раз при открытии сайта. */
export async function proveritVhod() {
  const dannye = await poslat(`${API}/vhod.php`);
  return Boolean(dannye.voshel);
}

/** Войти по паролю. */
export async function vojti(parol) {
  const telo = new URLSearchParams({ parol });
  await poslat(`${API}/vhod.php`, { method: 'POST', body: telo });
  return true;
}

/** Выйти из кабинета. */
export async function vyjti() {
  const telo = new URLSearchParams({ vyhod: '1' });
  await poslat(`${API}/vhod.php`, { method: 'POST', body: telo });
  return true;
}

/**
 * Забрать афишу с сервера.
 *
 * Ошибку здесь наверх не пробрасываем: если сервер недоступен, сайт должен
 * показать афишу из своей сборки, а не пустое место. Гость обязан увидеть
 * вечера при любой поломке в кабинете.
 */
export async function zabratAfishu() {
  try {
    const otvet = await fetch(`${API}/afisha.php`, { credentials: 'same-origin' });
    if (!otvet.ok) return null;
    const dannye = await otvet.json();
    return Array.isArray(dannye?.events) ? dannye.events : null;
  } catch {
    return null;
  }
}

/** Сохранить афишу целиком. */
export async function sohranitAfishu(vechera) {
  return poslat(`${API}/afisha.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: vechera }),
  });
}

/**
 * Загрузить картинку афиши.
 *
 * Сжатием занимается сервер: телефон отдаёт снимок на несколько мегабайт, а на
 * сайт должна лечь лёгкая картинка. Здесь мы только отправляем файл и получаем
 * обратно путь к готовой.
 */
export async function zagruzitFoto(fajl) {
  const telo = new FormData();
  telo.append('foto', fajl);
  return poslat(`${API}/foto.php`, { method: 'POST', body: telo });
}
