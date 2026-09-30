/**
 * Общее состояние кабинета: вошли или нет, что сейчас в афише и в составе резидентов.
 *
 * Держится в одном месте, потому что нужно сразу в нескольких частях сайта:
 * шапке (кнопка входа), афише (карандаши на карточках) и форме правки.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import vstroennayaAfisha from '../data/events.json';
import vstroennyeRezidenty from '../data/residents.json';
import {
  proveritVhod, vojti as apiVojti, vyjti as apiVyjti,
  zabratAfishu, sohranitAfishu, zabratRezidentov, sohranitRezidentovNaServere,
} from './api';

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
  // Резиденты — по той же схеме: сначала из сборки, затем свежие с сервера.
  const [rezidenty, setRezidenty] = useState(() => vstroennyeRezidenty.residents || []);
  const [voshel, setVoshel] = useState(false);
  const [rezhimPravki, setRezhimPravki] = useState(false);

  // Свежие данные с сервера.
  const obnovitAfishu = useCallback(async () => {
    const svezhie = await zabratAfishu();
    if (svezhie) {
      setVechera(svezhie);
    }
  }, []);

  const obnovitRezidentov = useCallback(async () => {
    const svezhie = await zabratRezidentov();
    if (svezhie) {
      setRezidenty(svezhie);
    }
  }, []);

  // Перечитать всё, что правится в кабинете: после входа и выхода меняется,
  // видны ли скрытые вечера и резиденты.
  const obnovitVsyo = useCallback(
    () => Promise.all([obnovitAfishu(), obnovitRezidentov()]),
    [obnovitAfishu, obnovitRezidentov],
  );

  useEffect(() => {
    obnovitVsyo();
  }, [obnovitVsyo]);

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
    // После входа перечитываем данные: вошедшему показываются и скрытые записи.
    await obnovitVsyo();
  }, [obnovitVsyo]);

  const vyjti = useCallback(async () => {
    await apiVyjti();
    setVoshel(false);
    setRezhimPravki(false);
    await obnovitVsyo();
  }, [obnovitVsyo]);

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

  /** Сохранить весь список резидентов. Порядок тот же: сервер, потом экран. */
  const sohranitRezidentov = useCallback(async (novye) => {
    await sohranitRezidentovNaServere(novye);
    await obnovitRezidentov();
  }, [obnovitRezidentov]);

  const znachenie = useMemo(() => ({
    vechera,
    rezidenty,
    voshel,
    rezhimPravki,
    setRezhimPravki,
    vojti,
    vyjti,
    sohranitVechera,
    sohranitRezidentov,
    obnovitAfishu,
  }), [vechera, rezidenty, voshel, rezhimPravki, vojti, vyjti, sohranitVechera, sohranitRezidentov, obnovitAfishu]);

  return <Kontekst.Provider value={znachenie}>{children}</Kontekst.Provider>;
}
