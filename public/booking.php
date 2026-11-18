<?php
/**
 * Приём заявок с сайта клуба «Вне времени».
 *
 * Принимает заявку от формы бронирования и пересылает её организатору в Telegram.
 * Токен бота в код сайта не попадает никогда — ради этого обработчик и существует.
 *
 * Раньше это была функция на Cloudflare. От Cloudflare пришлось уйти: российские
 * провайдеры режут соединения к зарубежным сетям после первых 16 КБ, и сайт
 * не догружался у большинства гостей. Теперь всё живёт на российском хостинге.
 *
 * Токены лежат в club-config.php ВЫШЕ корня сайта — оттуда их не отдаст веб-сервер,
 * даже если ошибиться в настройках. Файл кладётся на хостинг один раз руками
 * и в репозиторий не попадает.
 */

declare(strict_types=1);

require __DIR__ . '/club-lib.php';

const MAX_BODY_BYTES = 2048;

const KIND_TITLES = [
    'new'    => '🕐 НОВАЯ ЗАЯВКА — ждёт оплаты',
    'update' => '✏️ ЗАЯВКА ИЗМЕНЕНА — ждёт оплаты',
    'paid'   => '✅ ГОСТЬ НАЖАЛ «Я ОПЛАТИЛ» — проверьте поступление',
];

function respond(array $body, int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function onlyDigits($value): string
{
    return preg_replace('/\D/', '', (string) $value) ?? '';
}

/** Возвращает код ошибки или null, если заявка выглядит настоящей. */
function findProblem($data): ?string
{
    if (!is_array($data)) {
        return 'bad-json';
    }
    // Ловушка для ботов: у человека это поле всегда пустое.
    if (!empty($data['company'])) {
        return 'spam';
    }
    if (!isset($data['kind']) || !isset(KIND_TITLES[$data['kind']])) {
        return 'bad-kind';
    }

    $name = trim((string) ($data['name'] ?? ''));
    $length = mb_strlen($name);
    if ($length < 3 || $length > 100) {
        return 'bad-name';
    }

    if (strlen(onlyDigits($data['phone'] ?? '')) !== 11) {
        return 'bad-phone';
    }

    $tickets = $data['tickets'] ?? null;
    if (!is_int($tickets) && !(is_string($tickets) && ctype_digit($tickets))) {
        return 'bad-tickets';
    }
    $tickets = (int) $tickets;
    if ($tickets < 1 || $tickets > 20) {
        return 'bad-tickets';
    }

    $total = $data['total'] ?? null;
    if (!is_numeric($total) || $total < 0 || $total > 1000000) {
        return 'bad-total';
    }

    if (mb_strlen((string) ($data['eventTitle'] ?? '')) > 200) {
        return 'bad-event';
    }

    return null;
}

function buildMessage(array $data): string
{
    $esc = static function ($value) {
        return htmlspecialchars((string) $value, ENT_NOQUOTES, 'UTF-8');
    };

    $phone = '+' . onlyDigits($data['phone']);
    $total = number_format((float) $data['total'], 0, ',', ' ');

    $lines = [
        '<b>' . KIND_TITLES[$data['kind']] . '</b>',
        '',
        '<b>Вечер:</b> ' . $esc($data['eventTitle'] ?? '—'),
    ];
    if (!empty($data['eventDate'])) {
        $lines[] = '<b>Дата вечера:</b> ' . $esc($data['eventDate']);
    }
    array_push(
        $lines,
        '',
        '<b>Гость:</b> ' . $esc(trim((string) $data['name'])),
        '<b>Телефон:</b> <a href="tel:' . $esc($phone) . '">' . $esc($data['phone']) . '</a>',
        '<b>Билетов:</b> ' . (int) $data['tickets'],
        '<b>Сумма:</b> ' . $total . ' ₽',
        '',
        '<b>Заявка №</b> ' . $esc($data['bookingId'] ?? '—'),
        '<i>Получено ' . date('d.m H:i') . ' МСК</i>'
    );

    if ($data['kind'] === 'paid') {
        array_push($lines, '', '⚠️ Гость сообщил об оплате. Сверьте поступление в банке.');
    }

    return implode("\n", $lines);
}

/**
 * Простой ограничитель: не больше десяти заявок с одного адреса за час.
 *
 * Без него любой человек скриптом за минуту завалил бы Telegram заказчицы
 * тысячей заявок, и настоящие потерялись бы среди мусора.
 *
 * При любой ошибке пропускаем заявку: потерять настоящую бронь хуже,
 * чем пропустить лишнюю.
 */
function tooManyRequests(): bool
{
    $limit = 10;
    $window = 3600;

    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        if ($ip === '') return false;

        $dir = sys_get_temp_dir() . '/vnevremeni-booking';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;

        $file = $dir . '/' . md5($ip) . '.json';
        $now = time();
        $state = ['start' => $now, 'count' => 0];

        if (is_readable($file)) {
            $saved = json_decode((string) @file_get_contents($file), true);
            if (is_array($saved) && isset($saved['start'], $saved['count']) && $now - $saved['start'] < $window) {
                $state = $saved;
            }
        }

        $state['count']++;
        @file_put_contents($file, json_encode($state), LOCK_EX);

        return $state['count'] > $limit;
    } catch (\Throwable $e) {
        return false;
    }
}

function sendToTelegram(string $text, array $config): bool
{
    $url = 'https://api.telegram.org/bot' . $config['TELEGRAM_BOT_TOKEN'] . '/sendMessage';
    $payload = json_encode([
        'chat_id'                  => $config['TELEGRAM_CHAT_ID'],
        'text'                     => $text,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE);

    // Почему несколько попыток разными путями (замер с хостинга reg.ru, 18.11.2026):
    // DNS отдаёт для api.telegram.org адрес 149.154.166.110, а он из российской сети
    // не открывается вовсе (0 из 15). Через IPv6 проходит ~9 из 10, через другой
    // адрес Telegram 149.154.167.220 - ~7 из 10. Пробуем по очереди - так заявка
    // доходит почти всегда. На обычном хостинге первая же попытка срабатывает.
    $popytki = [
        [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V6],
        [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4, CURLOPT_RESOLVE => ['api.telegram.org:443:149.154.167.220']],
        [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V6],
        [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4, CURLOPT_RESOLVE => ['api.telegram.org:443:149.154.167.220']],
        [], // обычный путь, как было
    ];

    $oshibki = [];
    foreach ($popytki as $nomer => $put) {
        $curl = curl_init($url);
        curl_setopt_array($curl, $put + [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT        => 8,
        ]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($status === 200) {
            if ($nomer > 0) {
                error_log('telegram: доставлено с попытки ' . ($nomer + 1));
            }
            return true;
        }
        // Telegram ответил, но отказал (неверный токен, чат) - повторять бесполезно.
        if ($status >= 400 && $status < 500) {
            $oshibki[] = $status . ' ' . (string) $body;
            break;
        }
        $oshibki[] = $status . ' ' . $error;
    }

    // Подробности в лог хостинга, наружу — только факт неудачи.
    error_log('telegram-failed ' . implode(' | ', $oshibki));
    return false;
}

date_default_timezone_set('Europe/Moscow');

// Форма и обработчик на одном домене, так что эти заголовки нужны только для
// запасного адреса и для предполётных запросов браузера.
//
// Origin разрешаем не любой: иначе чужая страница смогла бы слать заявки от имени
// посетителя и завалить Telegram заказчицы. Но и требовать его строго нельзя —
// Safari на однодоменных запросах Origin шлёт не всегда, и айфоны остались бы
// без брони.
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

$host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://' . $host, 'http://' . $host, 'https://vnevremeni-club.ru', 'https://www.vnevremeni-club.ru'];

if ($origin === '' || in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . ($origin !== '' ? $origin : 'https://' . $host));
} elseif (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') {
    respond(['error' => 'origin-not-allowed'], 403);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(['error' => 'method-not-allowed'], 405);
}

$raw = file_get_contents('php://input');
if ($raw === false) {
    $raw = '';
}
if (strlen($raw) > MAX_BODY_BYTES) {
    respond(['error' => 'too-large'], 413);
}

$data = json_decode($raw, true);
$problem = findProblem($data);

// Спам-ботам отвечаем «ок», чтобы они не подбирали формат и не пробовали снова.
if ($problem === 'spam') {
    respond(['ok' => true], 200);
}
if ($problem !== null) {
    respond(['error' => $problem], 400);
}

// Живой человек больше десяти броней за час не делает. Отвечаем как обычно,
// чтобы тот, кто долбится скриптом, не понял, что его отсекли, и не начал подбирать.
if (tooManyRequests()) {
    error_log('booking: превышен предел заявок с адреса ' . ($_SERVER['REMOTE_ADDR'] ?? '?'));
    respond(['ok' => true], 200);
}

$config = club_secrets();
if (empty($config['TELEGRAM_BOT_TOKEN']) || empty($config['TELEGRAM_CHAT_ID'])) {
    error_log('booking: club-config.php не найден или пуст');
    respond(['error' => 'not-configured'], 500);
}

if (!sendToTelegram(buildMessage($data), $config)) {
    respond(['error' => 'delivery-failed'], 502);
}

respond(['ok' => true], 200);
