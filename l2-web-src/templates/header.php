<?php
if (!defined('DB_HOST')) { include_once __DIR__ . '/../app/config.php'; }
require_once __DIR__ . '/../public/includes/Lang.php';
$css = __DIR__ . '/../public/assets/css/modern_glass.css';
$cssH = __DIR__ . '/../public/assets/css/site-header.css';
$cssW = __DIR__ . '/../public/assets/css/l2-world.css';
$cssR = __DIR__ . '/../public/assets/css/site-responsive.css';
$jsH = __DIR__ . '/../public/assets/js/site-header.js';
$jsW = __DIR__ . '/../public/assets/js/l2-world.js';
$jsF = __DIR__ . '/../public/assets/js/site-fit-text.js';
$v = max(
    is_file($css) ? filemtime($css) : 1,
    is_file($cssH) ? filemtime($cssH) : 1,
    is_file($cssW) ? filemtime($cssW) : 1,
    is_file($cssR) ? filemtime($cssR) : 1,
    is_file($jsH) ? filemtime($jsH) : 1,
    is_file($jsW) ? filemtime($jsW) : 1,
    is_file($jsF) ? filemtime($jsF) : 1
);

$world_percent = 0;
$world_bar_color = 'rgb(255, 69, 58)';
if (isset($conn)) {
    $res = $conn->query("SELECT IFNULL(SUM(coins),0) as t FROM web_donate_logs WHERE coins > 0 AND MONTH(created_at)=MONTH(CURRENT_DATE()) AND YEAR(created_at)=YEAR(CURRENT_DATE())");
    if ($res) {
        $t = (int) $res->fetch_assoc()['t'];
        $world_percent = min(100, round(($t / 1400) * 100));
        $world_bar_color = ($world_percent <= 50)
            ? 'rgb(255,' . round(255 * ($world_percent / 50)) . ',0)'
            : 'rgb(' . round(255 * (1 - (($world_percent - 50) / 50))) . ',255,0)';
    }
}

$user = $_SESSION['login'] ?? null;
$my_balance = 0;
$is_admin = false;
$pulse_online = 0;
$pulse_game = 'off';
if (isset($conn)) {
    $pr = @$conn->query('SELECT COUNT(*) n FROM characters WHERE online=1');
    if ($pr) {
        $pulse_online = (int) $pr->fetch_assoc()['n'];
    }
}
require_once __DIR__ . '/../public/includes/server_state.php';
$pulse_game = l2_svc_state('jar GameServer.jar', 7777);
$pulse_cls = $pulse_game === 'on' ? 'up' : ($pulse_game === 'boot' ? 'boot' : 'down');
$pulse_title = $pulse_game === 'on' ? 'Świat ONLINE' : ($pulse_game === 'boot' ? 'Świat się ładuje' : 'Świat DOWN');
$is_patron = false;
if ($user && isset($conn)) {
    $st_b = $conn->prepare("SELECT balance FROM web_credits WHERE account_name = ?");
    $st_b->bind_param("s", $user);
    $st_b->execute();
    $row_b = $st_b->get_result()->fetch_assoc();
    if ($row_b) {
        $my_balance = (int) $row_b['balance'];
    }
    $is_admin = isset($_SESSION['accessLevel']) && (int) $_SESSION['accessLevel'] > 0;
    $st_p = $conn->prepare('SELECT enddate FROM account_premium WHERE account_name = ? LIMIT 1');
    if ($st_p) {
        $st_p->bind_param('s', $user);
        $st_p->execute();
        $row_p = $st_p->get_result()->fetch_assoc();
        if ($row_p) {
            $nowMs = (int) round(microtime(true) * 1000);
            $is_patron = ((int) $row_p['enddate']) > $nowMs;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pl" data-patron="<?= !empty($is_patron) ? '1' : '0' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Nostalgie™ Legacy</title>
    <meta property="og:title" content="Lineage II Nostalgie™ - Sezon I LIVE — High Five" />
    <meta property="og:description" content="Top Gear tylko z Craftu • Płatny Teleport • Profesje przez Quest. Craft economy · Offline trade · Launcher z auto-update. Dołącz do Sezonu I." />
    <meta property="og:image" content="https://lineage.mycloudnas.com/assets/img/l2nos.png" />
    <meta property="og:url" content="https://lineage.mycloudnas.com/" />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#0a0a0e" />
    <link rel="icon" href="/assets/img/l2nos.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="/assets/css/modern_glass.css?v=<?= $v ?>">
    <link rel="stylesheet" href="/assets/css/site-header.css?v=<?= $v ?>">
    <link rel="stylesheet" href="/assets/css/l2-world.css?v=<?= $v ?>">
    <link rel="stylesheet" href="/assets/css/site-responsive.css?v=<?= $v ?>">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script defer src="/assets/js/site-header.js?v=<?= $v ?>"></script>
    <script defer src="/assets/js/site-fit-text.js?v=<?= $v ?>"></script>
    <script defer src="/assets/js/l2-world.js?v=<?= $v ?>"></script>
<?php if ($user): ?>
    <script defer src="/admin_pro/movies/inject.js?v=20260909020000"></script>
<?php endif; ?>
<?php if (!empty($extra_head)) echo $extra_head; ?>
</head>
<body class="l2-world">
<header class="site-header nc-header" id="nc-header">
    <div class="header-container nc-header__bar">
        <a href="/" class="nc-header__brand" aria-label="Nostalgie Legacy — strona główna">
            <span class="nc-header__mark" aria-hidden="true">
                <img src="/assets/img/l2nos.png" alt="" width="40" height="40" decoding="async">
            </span>
            <span class="nc-header__wordmark">
                <span class="nc-header__name">
                    <span class="nc-header__brand-top">Nostalgie™</span>
                    <span class="nc-header__brand-main">Legacy</span>
                </span>
                <span class="world-pulse <?= htmlspecialchars($pulse_cls) ?>" id="world-pulse" title="<?= htmlspecialchars($pulse_title) ?>">
                    <i class="pip"></i>
                    <b id="wp-n"><?= (int) $pulse_online ?></b> online
                </span>
            </span>
        </a>

        <button type="button" class="nc-header__toggle" id="nc-header-toggle" aria-expanded="false" aria-controls="nc-header-menu" aria-label="Menu">
            <span></span><span></span><span></span>
        </button>

    <div class="nc-header__menu" id="nc-header-menu" aria-hidden="true">
        <nav class="nc-header__nav" aria-label="Główne menu">
            <ul class="nav-links">
                <?php if ($user): ?>
                    <li><a href="/panel.php" class="nav-item">Panel</a></li>
                    <li><a href="/shop.php" class="nav-item">Patron</a></li>
                    <li><a href="/donate.php" class="nav-item gold-link">Doładuj</a></li>
                <?php else: ?>
                    <li><a href="/about_world.php" class="nav-item">O Świecie</a></li>
                <?php endif; ?>
                <li><a href="/ranking.php" class="nav-item">Ranking</a></li>
                <li><a href="/market.php" class="nav-item">Rynek</a></li>
                <li><a href="/faq.php" class="nav-item">FAQ</a></li>
                <li><a href="/zglos.php" class="nav-item">Zgłoś</a></li>
            </ul>
        </nav>

        <div class="nc-header__actions">
            <?php if ($user): ?>
                <a href="/donate.php" class="nc-coins-chip" title="Doładuj NC Coins">
                    <span class="nc-coins-chip__icon" aria-hidden="true">N</span>
                    <span class="nc-coins-chip__text">
                        <span class="nc-coins-chip__val"><?= number_format($my_balance, 0, ',', '.') ?></span>
                        <span class="nc-coins-chip__lbl">NC Coins</span>
                    </span>
                </a>
                <a href="/panel.php" class="nc-user-pill">
                    <span class="nc-user-pill__dot" aria-hidden="true"></span>
                    <span class="nc-user-pill__name"><?= htmlspecialchars($user) ?></span>
                </a>
                <?php if ($is_admin): ?>
                    <a href="/admin_pro/" class="btn-header-pro nc-admin-btn">Admin</a>
                <?php endif; ?>
                <a href="/logout.php" class="nc-logout-btn" title="Wyloguj" aria-label="Wyloguj">⏻</a>
            <?php else: ?>
                <a href="/login.php" class="nc-btn-ghost">Logowanie</a>
                <a href="/register.php" class="nc-btn-primary btn gold">Dołącz</a>
            <?php endif; ?>
        </div>

        <div class="nc-header__world" aria-label="Postęp wsparcia świata">
            <div class="nc-world-bar-wrap">
                <div class="nc-world-bar">
                    <div class="nc-world-bar__fill bar-fill" style="width:<?= $world_percent ?>%; background:<?= $world_bar_color ?>;"></div>
                </div>
                <span class="nc-world-label">Wsparcie świata — <?= $world_percent ?>%</span>
            </div>
        </div>
    </div>
    </div>
</header>
<div class="nc-header-spacer" id="nc-header-spacer" aria-hidden="true"></div>
