<?php
/**
 * Вход в кабинет по паролю.
 *
 * Пароль в коде не лежит — только его отпечаток (хеш) в club-config.php выше
 * корня сайта. По отпечатку восстановить пароль нельзя, поэтому даже если
 * когда-нибудь весь код сайта окажется в чужих руках, войти по нему не выйдет.
 *
 * Три действия по адресу /api/vhod.php:
 *   GET               — вошёл я или нет (сайт спрашивает это при открытии)
 *   POST parol=...    — войти
 *   POST vyhod=1      — выйти
 */

declare(strict_types=1);

require __DIR__ . '/kabinet-lib.php';

/**
 * Сколько ждать после неудачных попыток.
 *
 * Пароль у кабинета один, и подбирать его можно бесконечно — если не мешать.
 * После пяти промахов подряд с одного адреса вход закрывается на 15 минут:
 * человеку, который просто опечатался, пяти попыток хватает с запасом, а
 * перебор паролей становится делом на годы.
 */
const KAB_PROMAHOV_DO_PAUZY = 5;
const KAB_PAUZA_SEKUND      = 900;

function kab_fajl_popytok(): string
{
    return kab_papka_dannyh() . '/popytki-vhoda.json';
}

function kab_popytki_prochitat(): array
{
    $file = kab_fajl_popytok();
    if (!is_readable($file)) {
        return [];
    }
    $dannye = json_decode((string)file_get_contents($file), true);
    return is_array($dannye) ? $dannye : [];
}

function kab_popytki_zapisat(array $dannye): void
{
    $papka = kab_papka_dannyh();
    if (!is_dir($papka)) {
        @mkdir($papka, 0755, true);
    }
    // Записи старше суток не нужны — иначе файл растёт без предела.
    $porog = time() - 86400;
    $dannye = array_filter($dannye, static fn($z) => ($z['kogda'] ?? 0) > $porog);
    @file_put_contents(kab_fajl_popytok(), json_encode($dannye, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function kab_klyuch_adresa(): string
{
    return md5((string)($_SERVER['REMOTE_ADDR'] ?? 'neizvesten'));
}

$metod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Кто я -----------------------------------------------------------------
if ($metod === 'GET') {
    kab_otvet(['ok' => true, 'voshel' => kab_voshel()]);
}

if ($metod !== 'POST') {
    kab_oshibka('Такой способ обращения не поддерживается.', 405);
}

// ---- Выход -----------------------------------------------------------------
if (!empty($_POST['vyhod'])) {
    kab_sessiya();
    $_SESSION = [];
    session_destroy();
    kab_v_zhurnal('kabinet-vyhod');
    kab_otvet(['ok' => true, 'voshel' => false]);
}

// ---- Вход ------------------------------------------------------------------
$config = club_secrets();
$otpechatok = (string)($config['KABINET_PAROL_HASH'] ?? '');

if ($otpechatok === '') {
    kab_v_zhurnal('kabinet-vhod-ne-nastroen');
    kab_oshibka('Вход в кабинет ещё не настроен на сервере.', 500);
}

$popytki = kab_popytki_prochitat();
$klyuch  = kab_klyuch_adresa();
$zapis   = $popytki[$klyuch] ?? ['promahov' => 0, 'kogda' => 0];

// Пауза после серии промахов.
$proshlo = time() - (int)$zapis['kogda'];
if ((int)$zapis['promahov'] >= KAB_PROMAHOV_DO_PAUZY && $proshlo < KAB_PAUZA_SEKUND) {
    $ostalos = (int)ceil((KAB_PAUZA_SEKUND - $proshlo) / 60);
    kab_v_zhurnal('kabinet-vhod-zablokirovan', ['ostalos_minut' => $ostalos]);
    kab_oshibka("Слишком много неудачных попыток. Попробуйте через $ostalos мин.", 429);
}

$parol = (string)($_POST['parol'] ?? '');

if ($parol === '' || !password_verify($parol, $otpechatok)) {
    $popytki[$klyuch] = [
        'promahov' => (int)$zapis['promahov'] + 1,
        'kogda'    => time(),
    ];
    kab_popytki_zapisat($popytki);
    kab_v_zhurnal('kabinet-parol-ne-podoshel', ['promahov' => $popytki[$klyuch]['promahov']]);

    // Пауза перед ответом: делает перебор ещё медленнее, человеку незаметна.
    usleep(500000);
    kab_oshibka('Пароль не подошёл.', 401);
}

// Пароль верный — счётчик промахов сбрасываем.
unset($popytki[$klyuch]);
kab_popytki_zapisat($popytki);

kab_sessiya();
// Новый номер сессии после входа: страховка от подмены чужой заранее
// подсунутой сессии.
session_regenerate_id(true);
$_SESSION['kabinet_vhod'] = true;
$_SESSION['voshel_kogda'] = time();

kab_v_zhurnal('kabinet-vhod-udachno');
kab_otvet(['ok' => true, 'voshel' => true]);
