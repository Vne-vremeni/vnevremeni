<?php
/**
 * Афиша: отдать сайту и сохранить правки из кабинета.
 *
 *   GET  /api/afisha.php  — отдать список вечеров (это читает сам сайт)
 *   POST /api/afisha.php  — сохранить список (только для вошедших в кабинет)
 *
 * Почему сайт берёт афишу отсюда, а не из своей сборки. Раньше тексты были
 * «запечены» в код при сборке: чтобы поменять дату вечера, приходилось
 * пересобирать весь сайт через GitHub — около двух минут ожидания, и всё это
 * зависело от того, доступен ли GitHub из России сегодня. Теперь правка
 * ложится в файл на нашем хостинге и видна сразу, а GitHub из этой цепочки
 * убран совсем.
 */

declare(strict_types=1);

require __DIR__ . '/kabinet-lib.php';

const KAB_FAJL_AFISHI = 'events.json';

/** Копия из сборки сайта — с неё кабинет начинает, пока своих данных ещё нет. */
function kab_zapasnaya_afisha(): string
{
    return dirname(__DIR__) . '/dannye-iz-sborki/events.json';
}

$metod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Отдать афишу сайту ----------------------------------------------------
if ($metod === 'GET') {
    $dannye = kab_prochitat(KAB_FAJL_AFISHI, kab_zapasnaya_afisha());

    if (!isset($dannye['events']) || !is_array($dannye['events'])) {
        $dannye = ['events' => []];
    }

    // Скрытые вечера наружу не отдаём вовсе — иначе снятый с публикации вечер
    // можно было бы подсмотреть в исходном коде страницы.
    if (!kab_voshel()) {
        $dannye['events'] = array_values(array_filter(
            $dannye['events'],
            static fn($v) => empty($v['hidden'])
        ));
    }

    header('Content-Type: application/json; charset=utf-8');
    // Полминуты кеша: частые заходы не дёргают сервер, а правка появляется
    // почти сразу. Вошедшим в кабинет кеш не нужен — они должны видеть
    // результат своей правки немедленно.
    header(kab_voshel() ? 'Cache-Control: no-store' : 'Cache-Control: public, max-age=30');
    echo json_encode($dannye, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($metod !== 'POST') {
    kab_oshibka('Такой способ обращения не поддерживается.', 405);
}

// ---- Сохранить правки ------------------------------------------------------
kab_trebuet_vhoda();

$telo = file_get_contents('php://input');
$prislano = json_decode((string)$telo, true);

if (!is_array($prislano) || !isset($prislano['events']) || !is_array($prislano['events'])) {
    kab_oshibka('Данные пришли в непонятном виде — сохранять нечего.');
}

/**
 * Разбор одного вечера.
 *
 * Берём только известные поля и приводим каждое к нужному виду. Что пришло
 * лишнего — отбрасываем. Так случайная ошибка в кабинете не может испортить
 * файл данных и положить сайт: до файла доедет только то, что мы ожидаем.
 */
function kab_razobrat_vecher(array $v): array
{
    $tekst = static fn(string $klyuch, int $predel = 400): string
        => mb_substr(trim((string)($v[$klyuch] ?? '')), 0, $predel);

    $id = $tekst('id', 80);
    // Опознавательное имя вечера участвует в адресах картинок, поэтому в нём
    // допускаем только латиницу, цифры и дефис.
    $id = preg_replace('/[^a-z0-9\-]/', '', mb_strtolower($id)) ?: '';
    if ($id === '') {
        $id = 'vecher-' . date('Y-m-d-His') . '-' . bin2hex(random_bytes(2));
    }

    $data = $tekst('date', 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
        kab_oshibka('У одного из вечеров не указана дата или она в непонятном виде.');
    }

    $vremya = $tekst('time', 5);
    if ($vremya !== '' && !preg_match('/^\d{1,2}:\d{2}$/', $vremya)) {
        kab_oshibka('Время вечера должно быть в виде 19:00.');
    }

    $sbor = $tekst('gathering', 5);
    if ($sbor !== '' && !preg_match('/^\d{1,2}:\d{2}$/', $sbor)) {
        kab_oshibka('Время сбора должно быть в виде 18:00.');
    }

    $sostav = [];
    if (isset($v['lineup']) && is_array($v['lineup'])) {
        foreach ($v['lineup'] as $stroka) {
            $stroka = mb_substr(trim((string)$stroka), 0, 300);
            if ($stroka !== '') {
                $sostav[] = $stroka;
            }
        }
    }

    // Картинка: либо из сборки сайта, либо загруженная через кабинет.
    // Чужие адреса не пускаем — иначе на сайт можно было бы подставить
    // картинку с постороннего сервера.
    $afisha = $tekst('poster', 300);
    if ($afisha !== '' && !preg_match('#^\./(images|zagruzheno)/[A-Za-z0-9._/\-]+$#', $afisha)) {
        $afisha = '';
    }

    return [
        'id'          => $id,
        'hidden'      => !empty($v['hidden']),
        'title'       => $tekst('title', 200),
        'subtitle'    => $tekst('subtitle', 200),
        'date'        => $data,
        'time'        => $vremya,
        'gathering'   => $sbor,
        'venue'       => $tekst('venue', 200),
        'address'     => $tekst('address', 300),
        'metro'       => $tekst('metro', 100),
        'price'       => max(0, min(1000000, (int)($v['price'] ?? 0))),
        'note'        => $tekst('note', 400),
        'description' => $tekst('description', 3000),
        'lineup'      => $sostav,
        'poster'      => $afisha,
        'posterAlt'   => $tekst('posterAlt', 300),
    ];
}

$vechera = [];
foreach ($prislano['events'] as $syroj) {
    if (is_array($syroj)) {
        $vechera[] = kab_razobrat_vecher($syroj);
    }
}

if (count($vechera) > 100) {
    kab_oshibka('Слишком много вечеров в списке.');
}

kab_sohranit(KAB_FAJL_AFISHI, ['events' => $vechera], kab_zapasnaya_afisha());
kab_v_zhurnal('kabinet-afisha-sohranena', ['vecherov' => count($vechera)]);

kab_otvet(['ok' => true, 'vecherov' => count($vechera)]);
