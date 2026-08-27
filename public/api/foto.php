<?php
/**
 * Загрузка картинки из кабинета: приём, сжатие, сохранение.
 *
 * Почему картинку нельзя просто положить как есть. Заказчица выбирает фото
 * прямо в галерее телефона — это 3–5 мегабайт, тогда как афиши на сайте весят
 * около 150 килобайт. Положи такое как есть — страница начнёт открываться
 * втрое дольше, а на слабой мобильной связи может не открыться совсем. Ровно
 * из-за такого перевеса у заказчицы когда-то не открывался прежний кабинет.
 *
 * Поэтому сжатие здесь обязательная часть работы, а не пожелание: файл
 * ужимается до размера остальных афиш ещё до того, как попадёт на сайт.
 * Заказчице об этом знать не нужно — она просто выбирает фото.
 */

declare(strict_types=1);

require __DIR__ . '/kabinet-lib.php';

kab_trebuet_vhoda();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    kab_oshibka('Такой способ обращения не поддерживается.', 405);
}

/** Размер афиши на сайте — такой же, как у остальных. */
const KAB_SHIRINA = 720;
const KAB_VYSOTA  = 1280;
/** Больше 25 МБ телефон не снимает даже в самом тяжёлом режиме. */
const KAB_PREDEL_BAJT = 25 * 1024 * 1024;

$fajl = $_FILES['foto'] ?? null;

if (!is_array($fajl) || ($fajl['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $prichiny = [
        UPLOAD_ERR_INI_SIZE   => 'Файл слишком большой.',
        UPLOAD_ERR_FORM_SIZE  => 'Файл слишком большой.',
        UPLOAD_ERR_PARTIAL    => 'Файл дошёл не полностью — попробуйте ещё раз.',
        UPLOAD_ERR_NO_FILE    => 'Файл не выбран.',
        UPLOAD_ERR_NO_TMP_DIR => 'На сервере нет места для загрузки.',
        UPLOAD_ERR_CANT_WRITE => 'Не удалось записать файл на сервере.',
    ];
    kab_oshibka($prichiny[$fajl['error'] ?? UPLOAD_ERR_NO_FILE] ?? 'Не удалось принять файл.');
}

if (($fajl['size'] ?? 0) > KAB_PREDEL_BAJT) {
    kab_oshibka('Фотография слишком большая. Выберите другую.');
}

$vremennyj = (string)($fajl['tmp_name'] ?? '');
if ($vremennyj === '' || !is_uploaded_file($vremennyj)) {
    kab_oshibka('Файл не удалось прочитать.');
}

// Смотрим не на имя файла, а на само содержимое: имя можно назвать как угодно,
// а подделать внутренности картинки сложнее.
$svedeniya = @getimagesize($vremennyj);
if ($svedeniya === false) {
    kab_oshibka('Это не похоже на картинку. Выберите фотографию.');
}

$dopustimye = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF];
if (!in_array($svedeniya[2], $dopustimye, true)) {
    kab_oshibka('Такой вид картинок не поддерживается. Подойдёт JPG, PNG или WebP.');
}

$papka = kab_papka_zagruzok() . '/events';
if (!is_dir($papka) && !mkdir($papka, 0755, true) && !is_dir($papka)) {
    kab_oshibka('Не удалось создать папку для картинок на сервере.', 500);
}

// Имя с меткой времени: прежняя картинка остаётся на месте. Если новая
// не понравится, вернуть старую можно, не набирая ничего заново.
$imya = 'afisha-' . date('Y-m-d_H-i-s') . '-' . bin2hex(random_bytes(3)) . '.webp';
$kuda = $papka . '/' . $imya;

/**
 * Сжать и сохранить.
 *
 * Imagick надёжнее разбирается с поворотом кадра: телефон часто пишет снимок
 * боком и помечает «повернуть при показе». Не учтёшь эту пометку — афиша
 * ляжет на сайт набок. Если Imagick недоступен, работаем через GD.
 */
function kab_szhat_imagick(string $otkuda, string $kuda): bool
{
    if (!extension_loaded('imagick')) {
        return false;
    }
    try {
        $kartinka = new Imagick($otkuda);
        // Многокадровые файлы (анимация) схлопываем в один кадр.
        $kartinka = $kartinka->coalesceImages()->flattenImages();
        $kartinka->autoOrient();
        // Вписываем в рамку, сохраняя пропорции: афиша не должна быть растянута.
        $kartinka->thumbnailImage(KAB_SHIRINA, KAB_VYSOTA, true);
        $kartinka->setImageFormat('webp');
        $kartinka->setImageCompressionQuality(88);
        // Данные съёмки (модель телефона, а иногда и место) на сайт не выкладываем.
        $kartinka->stripImage();
        $ok = $kartinka->writeImage($kuda);
        $kartinka->clear();
        return (bool)$ok;
    } catch (Throwable $e) {
        error_log('kabinet foto imagick: ' . $e->getMessage());
        return false;
    }
}

function kab_szhat_gd(string $otkuda, string $kuda, int $tip): bool
{
    if (!extension_loaded('gd')) {
        return false;
    }

    $ishodnik = match ($tip) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($otkuda),
        IMAGETYPE_PNG  => @imagecreatefrompng($otkuda),
        IMAGETYPE_WEBP => @imagecreatefromwebp($otkuda),
        IMAGETYPE_GIF  => @imagecreatefromgif($otkuda),
        default        => false,
    };
    if (!$ishodnik) {
        return false;
    }

    // Пометка о повороте кадра: без неё снимок с телефона ляжет набок.
    if ($tip === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($otkuda);
        $povorot = (int)($exif['Orientation'] ?? 1);
        $ugol = match ($povorot) { 3 => 180, 6 => -90, 8 => 90, default => 0 };
        if ($ugol !== 0) {
            $povernuto = @imagerotate($ishodnik, $ugol, 0);
            if ($povernuto) {
                imagedestroy($ishodnik);
                $ishodnik = $povernuto;
            }
        }
    }

    $shirina_ish = imagesx($ishodnik);
    $vysota_ish  = imagesy($ishodnik);

    // Вписываем в рамку, сохраняя пропорции. Картинку меньше рамки не растягиваем:
    // от растягивания она станет мыльной, а весить будет больше.
    $mnozhitel = min(KAB_SHIRINA / $shirina_ish, KAB_VYSOTA / $vysota_ish, 1.0);
    $shirina = max(1, (int)round($shirina_ish * $mnozhitel));
    $vysota  = max(1, (int)round($vysota_ish * $mnozhitel));

    $itog = imagecreatetruecolor($shirina, $vysota);
    imagealphablending($itog, false);
    imagesavealpha($itog, true);
    imagecopyresampled($itog, $ishodnik, 0, 0, 0, 0, $shirina, $vysota, $shirina_ish, $vysota_ish);

    $ok = imagewebp($itog, $kuda, 88);

    imagedestroy($ishodnik);
    imagedestroy($itog);
    return (bool)$ok;
}

$poluchilos = kab_szhat_imagick($vremennyj, $kuda)
    || kab_szhat_gd($vremennyj, $kuda, (int)$svedeniya[2]);

if (!$poluchilos || !is_file($kuda)) {
    kab_v_zhurnal('kabinet-foto-ne-szhalos', ['tip' => (int)$svedeniya[2]]);
    kab_oshibka('Не удалось обработать эту фотографию. Попробуйте другую.', 500);
}

$stalo = (int)filesize($kuda);
kab_v_zhurnal('kabinet-foto-zagruzheno', [
    'bylo_kb'  => (int)round(($fajl['size'] ?? 0) / 1024),
    'stalo_kb' => (int)round($stalo / 1024),
]);

kab_otvet([
    'ok'       => true,
    'put'      => './zagruzheno/events/' . $imya,
    'bylo_kb'  => (int)round(($fajl['size'] ?? 0) / 1024),
    'stalo_kb' => (int)round($stalo / 1024),
]);
