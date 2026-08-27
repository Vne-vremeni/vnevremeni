/**
 * Общее состояние кабинета: вошли или нет, и что сейчас в афише.
 *
 * Держится в одном месте, потому что нужно сразу в нескольких частях сайта:
 * шапке (кнопка входа), афише (карандаши на карточках) и форме правки.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import vstroennayaAfisha from '../data/events.json';
import { proveritVhod, vojti as apiVojti, vyjti as apiVyjti, zabratAfishu, sohranitAfishu } from './api';

const Kontekst = createContext(null);

export function useKabinet() {
  const znachenie = useContext(Kontekst);
  if (!znachenie) {
    throw new Error('useKabinet вызван вне KabinetProvider');
  }
  return znachenie;
}

export function KabinetProvider({ children }) {
  // Афиша начинается со встроенной копии — она уже в сборке, показывается
  // мгновенно. Свежая версия с сервера приезжает следом и заменяет её.
  // Так гость видит вечера сразу, не дожидаясь ответа сервера, и видит их
  // даже если сервер вовсе не ответит.
  const [vechera, setVechera] = useState(() => vstroennayaAfisha.events || []);
  const [voshel, setVoshel] = useState(false);
  const [rezhimPravki, setRezhimPravki] = useState(false);

  // Свежие данные с сервера.
  const obnovitAfishu = useCallback(async () => {
    const svezhie = await zabratAfishu();
    if (svezhie) {
      setVechera(svezhie);
    }
  }, []);

  useEffect(() => {
    obnovitAfishu();
  }, [obnovitAfishu]);

  // Вошли ли мы — спрашиваем один раз при открытии сайта.
  useEffect(() => {
    let aktualno = true;
    proveritVhod()
      .then((otvet) => { if (aktualno) setVoshel(otvet); })
      // Молча: обычный гость не должен ничего заметить, если серверная
      // часть кабинета почему-то недоступна.
      .catch(() => {});
    return () => { aktualno = false; };
  }, []);

  const vojti = useCallback(async (parol) => {
    await apiVojti(parol);
    setVoshel(true);
    // После входа перечитываем афишу: вошедшему показываются и скрытые вечера.
    await obnovitAfishu();
  }, [obnovitAfishu]);

  const vyjti = useCallback(async () => {
    await apiVyjti();
    setVoshel(false);
    setRezhimPravki(false);
    await obnovitAfishu();
  }, [obnovitAfishu]);

  /**
   * Сохранить весь список вечеров.
   *
   * Сначала отправляем на сервер и только потом меняем то, что на экране.
   * Обратный порядок был бы обманом: при неудачной отправке заказчица видела
   * бы свою правку на экране и была уверена, что сохранилось, — а на сайте
   * ничего бы не изменилось.
   */
  const sohranitVechera = useCallback(async (novye) => {
    await sohranitAfishu(novye);
    await obnovitAfishu();
  }, [obnovitAfishu]);

  const znachenie = useMemo(() => ({
    vechera,
    voshel,
    rezhimPravki,
    setRezhimPravki,
    vojti,
    vyjti,
    sohranitVechera,
    obnovitAfishu,
  }), [vechera, voshel, rezhimPravki, vojti, vyjti, sohranitVechera, obnovitAfishu]);

  return <Kontekst.Provider value={znachenie}>{children}</Kontekst.Provider>;
}
