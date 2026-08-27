<?php
/**
 * Общее для нового кабинета: вход, пути к данным, сохранение с откатом.
 *
 * Зачем всё это, если кабинет уже был. Прежний кабинет (Sveltia CMS) — чужая
 * программа, которая сохраняла правки через GitHub. У заказчицы она не
 * открывалась: на её телефоне редактор просто не запускался, хотя все файлы
 * доходили. Разбирательство упёрлось в чужой код, который мы не правим.
 *
 * Этот кабинет обходится без чужих программ и без GitHub: обычные веб-формы
 * и этот файл. Формы работают в любом браузере любого возраста — это самая
 * простая веб-технология, ломаться там нечему.
 *
 * Сам по себе файл ничего не выводит — только объявляет функции.
 */

declare(strict_types=1);

require_once __DIR__ . '/../club-lib.php';

/** Папка с данными сайта: ВЫШЕ корня, поэтому выкладка её не трогает.
 *
 * Это не придирка к аккуратности, а защита от потери правок. Выкладка сайта
 * идёт командой rsync --delete: она стирает на сервере всё, чего нет в свежей
 * сборке. Лежи данные внутри сайта — первая же выкладка стёрла бы всё, что
 * заказчица наредактировала, и никто бы не понял почему.
 */
function kab_papka_dannyh(): string
{
    return dirname(__DIR__, 2) . '/dannye';
}

/** Папка загруженных картинок. Внутри сайта — их должен отдавать браузер напрямую.
 *
 * От стирания выкладкой защищена отдельно: в .github/workflows/deploy.yml
 * стоит --exclude 'zagruzheno'. Меняете имя папки здесь — поменяйте и там.
 */
function kab_papka_zagruzok(): string
{
    return dirname(__DIR__) . '/zagruzheno';
}

/** Ответ браузеру в едином виде. Всегда JSON, всегда с понятным текстом ошибки. */
function kab_otvet(array $dannye, int $kod = 200): never
{
    http_response_code($kod);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dannye, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Короткий отказ с человеческим текстом — его увидит заказчица, не разработчик. */
function kab_oshibka(string $soobshenie, int $kod = 400): never
{
    kab_otvet(['ok' => false, 'oshibka' => $soobshenie], $kod);
}

/**
 * Начать сессию. Кука живёт 30 дней: заказчица заходит с телефона и не должна
 * вводить пароль каждый раз — иначе кабинетом просто не будут пользоваться.
 */
function kab_sessiya(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 30 * 24 * 3600,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('kabinet');
    session_start();
}

/** Вошёл ли посетитель. */
function kab_voshel(): bool
{
    kab_sessiya();
    return !empty($_SESSION['kabinet_vhod']);
}

/**
 * Пустить дальше только вошедших. Ставится первой строкой в каждом обработчике,
 * который меняет данные, — иначе любой прохожий смог бы править сайт.
 */
function kab_trebuet_vhoda(): void
{
    if (!kab_voshel()) {
        kab_oshibka('Нужно войти в кабинет заново — похоже, вход устарел.', 401);
    }
}

/**
 * Прочитать файл данных.
 *
 * Если на сервере файла ещё нет (первый запуск после установки кабинета),
 * берём копию из сборки сайта — ту, что лежит рядом со страницами. Так кабинет
 * начинает работать сразу, без ручной подготовки папок.
 */
function kab_prochitat(string $imya, string $zapasnoj_put = ''): array
{
    $file = kab_papka_dannyh() . '/' . $imya;

    if (!is_readable($file) && $zapasnoj_put !== '' && is_readable($zapasnoj_put)) {
        $file = $zapasnoj_put;
    }

    if (!is_readable($file)) {
        return [];
    }

    $tekst = file_get_contents($file);
    if ($tekst === false) {
        return [];
    }

    $razobrano = json_decode($tekst, true);
    return is_array($razobrano) ? $razobrano : [];
}

/**
 * Сохранить файл данных, оставив копию предыдущей версии.
 *
 * Копия — не перестраховка, а обязательный шаг. Заказчица правит сайт с
 * телефона одна, без подстраховки; ошибётся или сотрёт нужное — вернуть будет
 * неоткуда. Каждая копия помечена временем, откат — это переименовать файл.
 *
 * Запись идёт через временный файл: если связь оборвётся на середине, целым
 * останется прежний файл, а не половина нового.
 */
function kab_sohranit(string $imya, array $dannye, string $zapasnoj_put = ''): void
{
    $papka = kab_papka_dannyh();
    if (!is_dir($papka) && !mkdir($papka, 0755, true) && !is_dir($papka)) {
        kab_oshibka('Не удалось создать папку для данных на сервере.', 500);
    }

    $file = $papka . '/' . $imya;

    // Копия предыдущей версии — до того, как тронули оригинал.
    //
    // В самый первый раз своего файла на сервере ещё нет: кабинет только
    // поставили, и данные читались из копии в сборке. Копировать тогда нужно
    // именно её — иначе первое же сохранение затрёт исходную афишу, и вернуть
    // её будет неоткуда. Проверено на своей шкуре при первой же проверке.
    $chto_kopirovat = is_file($file) ? $file : $zapasnoj_put;

    if ($chto_kopirovat !== '' && is_file($chto_kopirovat)) {
        $papka_kopij = $papka . '/kopii';
        if (!is_dir($papka_kopij)) {
            @mkdir($papka_kopij, 0755, true);
        }
        if (is_dir($papka_kopij)) {
            $metka = date('Y-m-d_H-i-s');
            @copy($chto_kopirovat, $papka_kopij . '/' . pathinfo($imya, PATHINFO_FILENAME) . '_' . $metka . '.json');
            kab_podchistit_kopii($papka_kopij);
        }
    }

    $tekst = json_encode($dannye, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($tekst === false) {
        kab_oshibka('Не удалось подготовить данные к сохранению.', 500);
    }

    $vremennyj = $file . '.tmp';
    if (file_put_contents($vremennyj, $tekst, LOCK_EX) === false || !rename($vremennyj, $file)) {
        @unlink($vremennyj);
        kab_oshibka('Не удалось сохранить изменения на сервере.', 500);
    }
}

/**
 * Оставить последние 60 копий. Без этого папка растёт бесконечно и однажды
 * упрётся в место на хостинге — а заметят это в самый неподходящий момент.
 */
function kab_podchistit_kopii(string $papka, int $skolko_ostavit = 60): void
{
    $spisok = glob($papka . '/*.json');
    if (!is_array($spisok) || count($spisok) <= $skolko_ostavit) {
        return;
    }
    // Имена содержат дату и время, поэтому обычная сортировка = сортировка по времени.
    sort($spisok);
    foreach (array_slice($spisok, 0, count($spisok) - $skolko_ostavit) as $staryj) {
        @unlink($staryj);
    }
}

/**
 * Записать в журнал, что происходило в кабинете.
 *
 * Журнал уже используется на сайте и не раз выручал: когда кабинет не
 * открывался у заказчицы, именно записи показали, что файлы доходили целиком,
 * а не запускался сам редактор. Гадать не пришлось.
 */
function kab_v_zhurnal(string $sobytie, array $podrobnosti = []): void
{
    $zapis = array_merge([
        'time'    => date('d.m.Y H:i:s'),
        'ip'      => $_SERVER['REMOTE_ADDR'] ?? '',
        'sobytie' => $sobytie,
        'ua'      => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
    ], $podrobnosti);

    $stroka = json_encode($zapis, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    @file_put_contents(dirname(__DIR__, 2) . '/mayak.log', $stroka, FILE_APPEND | LOCK_EX);
}
