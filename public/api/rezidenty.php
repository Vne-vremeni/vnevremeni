<?php
/**
 * Резиденты: отдать сайту и сохранить правки из кабинета.
 *
 *   GET  /api/rezidenty.php  — отдать список резидентов (это читает сам сайт)
 *   POST /api/rezidenty.php  — сохранить список (только для вошедших в кабинет)
 *
 * Устроено так же, как афиша (afisha.php): данные лежат в файле на хостинге,
 * правка видна сразу, без пересборки сайта и без GitHub.
 */

declare(strict_types=1);

require __DIR__ . '/kabinet-lib.php';

const KAB_FAJL_REZIDENTOV = 'residents.json';

/** Копия из сборки сайта — с неё кабинет начинает, пока своих данных ещё нет. */
function kab_zapasnye_rezidenty(): string
{
    return dirname(__DIR__) . '/dannye-iz-sborki/residents.json';
}

/** Какие соцсети умеет показывать сайт. Иконки для них — в src/components/SocialIcons.jsx. */
const KAB_SOCSETI = ['tg', 'ig', 'yt', 'vk', 'stihi', 'site'];

$metod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Отдать резидентов сайту -----------------------------------------------
if ($metod === 'GET') {
    $dannye = kab_prochitat(KAB_FAJL_REZIDENTOV, kab_zapasnye_rezidenty());

    if (!isset($dannye['residents']) || !is_array($dannye['residents'])) {
        $dannye = ['residents' => []];
    }

    // Скрытых резидентов наружу не отдаём — как и скрытые вечера.
    if (!kab_voshel()) {
        $dannye['residents'] = array_values(array_filter(
            $dannye['residents'],
            static fn($r) => empty($r['hidden'])
        ));
    }

    header('Content-Type: application/json; charset=utf-8');
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

if (!is_array($prislano) || !isset($prislano['residents']) || !is_array($prislano['residents'])) {
    kab_oshibka('Данные пришли в непонятном виде — сохранять нечего.');
}

/**
 * Разбор одного резидента.
 *
 * Как и с вечерами: берём только известные поля и приводим к нужному виду,
 * лишнее отбрасываем — чтобы ошибка в кабинете не могла испортить файл.
 */
function kab_razobrat_rezidenta(array $r): array
{
    $tekst = static fn(string $klyuch, int $predel = 400): string
        => mb_substr(trim((string)($r[$klyuch] ?? '')), 0, $predel);

    $imya = $tekst('name', 100);
    if ($imya === '') {
        kab_oshibka('У одного из резидентов не указано имя.');
    }

    // Фото: из сборки сайта или загруженное через кабинет. Чужие адреса не пускаем.
    $foto = $tekst('image', 300);
    if ($foto !== '' && !preg_match('#^\./(residents|images|zagruzheno)/[A-Za-z0-9._/\-]+$#', $foto)) {
        $foto = '';
    }

    // Положение лица в кадре — процент от 0 до 100. Всё непонятное — к обычным 30%.
    $fokus = $tekst('imageFocus', 4);
    if (!preg_match('/^(\d{1,3})%$/', $fokus, $sovpalo) || (int)$sovpalo[1] > 100) {
        $fokus = '30%';
    }

    $ssylki = [];
    if (isset($r['socials']) && is_array($r['socials'])) {
        foreach ($r['socials'] as $s) {
            if (!is_array($s)) {
                continue;
            }
            $vid = (string)($s['type'] ?? '');
            $adres = mb_substr(trim((string)($s['url'] ?? '')), 0, 300);
            // Только обычные веб-адреса: ссылка вида javascript: на сайте была бы дырой.
            if (in_array($vid, KAB_SOCSETI, true) && preg_match('#^https?://[^\s<>"]+$#i', $adres)) {
                $ssylki[] = ['type' => $vid, 'url' => $adres];
            }
        }
    }

    return [
        'name'       => $imya,
        'hidden'     => !empty($r['hidden']),
        'role'       => $tekst('role', 200),
        'image'      => $foto,
        'imageFocus' => $fokus,
        'bio'        => $tekst('bio', 5000),
        'socials'    => array_slice($ssylki, 0, 12),
    ];
}

$rezidenty = [];
foreach ($prislano['residents'] as $syroj) {
    if (is_array($syroj)) {
        $rezidenty[] = kab_razobrat_rezidenta($syroj);
    }
}

if (count($rezidenty) > 60) {
    kab_oshibka('Слишком много резидентов в списке.');
}

kab_sohranit(KAB_FAJL_REZIDENTOV, ['residents' => $rezidenty], kab_zapasnye_rezidenty());
kab_v_zhurnal('kabinet-rezidenty-sohraneny', ['rezidentov' => count($rezidenty)]);

kab_otvet(['ok' => true, 'rezidentov' => count($rezidenty)]);
