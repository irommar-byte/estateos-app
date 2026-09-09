<?php
require_once __DIR__ . '/../app/config.php';
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/includes/l2_functions.php';
require_once __DIR__ . '/includes/trade_lib.php';
require_once __DIR__ . '/includes/Store.php';

$user = $_SESSION['login'] ?? null;
if (!$user) {
    header('Location: /login.php');
    exit;
}

if (empty($_SESSION['panel_csrf'])) {
    $_SESSION['panel_csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['panel_csrf'];

$store = new Store($conn);
$flash = '';
$flashType = 'ok';

function panelCsrfOk($token)
{
    return isset($_SESSION['panel_csrf']) && is_string($token) && hash_equals($_SESSION['panel_csrf'], $token);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cid = (int) ($_POST['char_id'] ?? 0);
    $token = (string) ($_POST['csrf'] ?? '');
    if (!panelCsrfOk($token)) {
        $flash = 'Sesja wygasła. Odśwież panel i spróbuj ponownie.';
        $flashType = 'err';
    } elseif (!$store->characterBelongsTo($cid, $user)) {
        $flash = 'Nieprawidłowa postać.';
        $flashType = 'err';
    } elseif ($store->isCharacterOnline($cid)) {
        $flash = 'Postać jest w grze. Wyloguj się, potem użyj zarządzania.';
        $flashType = 'err';
    } elseif (isset($_POST['restore_vitals'])) {
        $st = $conn->prepare('UPDATE characters SET curHp=maxHp, curMp=maxMp, curCp=maxCp WHERE charId=? AND account_name=? AND online=0');
        $st->bind_param('is', $cid, $user);
        $st->execute();
        if ($st->affected_rows > 0) {
            $flash = 'HP, MP i CP przywrócone. Wejdź do gry.';
        } else {
            $flash = 'Brak zmian (postać online albo już pełne witalne).';
            $flashType = 'err';
        }
        $_GET['char_id'] = $cid;
    }
}

$nowMs = (int) round(microtime(true) * 1000);
$premEnd = 0;
$st = $conn->prepare('SELECT enddate FROM account_premium WHERE account_name=? LIMIT 1');
$st->bind_param('s', $user);
$st->execute();
$row = $st->get_result()->fetch_assoc();
if ($row) {
    $premEnd = (int) $row['enddate'];
}
$isPremium = $premEnd > $nowMs;
$premLeft = $isPremium ? (int) (($premEnd / 1000) - time()) : 0;
$wallet = $store->getBalance($user);

$chars = [];
$st = $conn->prepare(
    'SELECT c.charId, c.char_name, c.level, c.maxHp, c.curHp, c.maxMp, c.curMp, c.maxCp, c.curCp,
            c.sex, c.x, c.y, c.z, c.exp, c.sp, c.karma, c.fame, c.pvpkills, c.pkkills,
            c.race, c.classid, c.base_class, c.title, c.online, c.onlinetime, c.lastAccess,
            c.nobless, c.vitality_points, c.createDate, c.accesslevel, c.pccafe_points,
            c.face, c.hairStyle, c.hairColor, c.bookmarkslot, c.cancraft, c.clanid,
            d.clan_name, d.clan_level, d.reputation_score, d.hasCastle, d.ally_name
     FROM characters c
     LEFT JOIN clan_data d ON c.clanid = d.clan_id
     WHERE c.account_name = ?
     ORDER BY c.online DESC, c.level DESC, c.char_name ASC'
);
$st->bind_param('s', $user);
$st->execute();
$res = $st->get_result();
while ($r = $res->fetch_assoc()) {
    $chars[] = $r;
}

$accountTrades = [];
if ($user) {
    $st = $conn->prepare('SELECT t.charId, t.time, t.type, t.title FROM character_offline_trade t JOIN characters c ON c.charId=t.charId WHERE c.account_name=?');
    $st->bind_param('s', $user);
    $st->execute();
    $tr = $st->get_result();
    while ($row = $tr->fetch_assoc()) {
        $accountTrades[(int) $row['charId']] = $row;
    }
}

$activeId = isset($_GET['char_id']) ? (int) $_GET['char_id'] : (int) ($chars[0]['charId'] ?? 0);
$active = null;
foreach ($chars as $c) {
    if ((int) $c['charId'] === $activeId) {
        $active = $c;
        break;
    }
}
if (!$active && $chars) {
    $active = $chars[0];
    $activeId = (int) $active['charId'];
}

$subs = [];
$eq = [];
$friends = [];
$pending = [];
$adena = 0;
$whAdena = 0;
$invCount = 0;
$whCount = 0;
$pendingCol = 0;
$isHero = false;
$oly = null;
$raidPts = 0;
$recipes = 0;
$bookmarks = 0;
$hennas = 0;
$offline = null;
if ($active) {
    $cid = (int) $active['charId'];
    $st = $conn->prepare('SELECT class_id, level, exp, sp FROM character_subclasses WHERE charId=? ORDER BY class_id');
    $st->bind_param('i', $cid);
    $st->execute();
    $r = $st->get_result();
    while ($row = $r->fetch_assoc()) {
        $subs[] = $row;
    }
    $st = $conn->prepare("SELECT item_id, enchant_level, loc_data, count FROM items WHERE owner_id=? AND loc='PAPERDOLL' ORDER BY loc_data");
    $st->bind_param('i', $cid);
    $st->execute();
    $r = $st->get_result();
    while ($row = $r->fetch_assoc()) {
        $eq[] = $row;
    }
    $st = $conn->prepare("SELECT IFNULL(SUM(count),0) AS n FROM items WHERE owner_id=? AND item_id=57 AND loc='INVENTORY'");
    $st->bind_param('i', $cid);
    $st->execute();
    $adena = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare("SELECT IFNULL(SUM(count),0) AS n FROM items WHERE owner_id=? AND item_id=57 AND loc='WAREHOUSE'");
    $st->bind_param('i', $cid);
    $st->execute();
    $whAdena = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare("SELECT COUNT(*) AS n FROM items WHERE owner_id=? AND loc='INVENTORY'");
    $st->bind_param('i', $cid);
    $st->execute();
    $invCount = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare("SELECT COUNT(*) AS n FROM items WHERE owner_id=? AND loc='WAREHOUSE'");
    $st->bind_param('i', $cid);
    $st->execute();
    $whCount = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare('SELECT itemId, itemCount, itemSender FROM character_premium_items WHERE charId=? ORDER BY itemNum');
    $st->bind_param('i', $cid);
    $st->execute();
    $r = $st->get_result();
    while ($row = $r->fetch_assoc()) {
        $pending[] = $row;
        if ((int) $row['itemId'] === 4037) {
            $pendingCol += (int) $row['itemCount'];
        }
    }
    $st = $conn->prepare('SELECT 1 FROM heroes WHERE charId=? LIMIT 1');
    $st->bind_param('i', $cid);
    $st->execute();
    $isHero = (bool) $st->get_result()->fetch_assoc();
    $st = $conn->prepare('SELECT olympiad_points, competitions_done, competitions_won, competitions_lost, competitions_drawn FROM olympiad_nobles WHERE charId=? LIMIT 1');
    $st->bind_param('i', $cid);
    $st->execute();
    $oly = $st->get_result()->fetch_assoc() ?: null;
    $st = $conn->prepare('SELECT IFNULL(SUM(points),0) AS n FROM character_raid_points WHERE charId=?');
    $st->bind_param('i', $cid);
    $st->execute();
    $raidPts = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare('SELECT COUNT(*) AS n FROM character_recipebook WHERE charId=?');
    $st->bind_param('i', $cid);
    $st->execute();
    $recipes = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare('SELECT COUNT(*) AS n FROM character_tpbookmark WHERE charId=?');
    $st->bind_param('i', $cid);
    $st->execute();
    $bookmarks = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare('SELECT COUNT(*) AS n FROM character_hennas WHERE charId=? AND symbol_id>0');
    $st->bind_param('i', $cid);
    $st->execute();
    $hennas = (int) $st->get_result()->fetch_assoc()['n'];
    $st = $conn->prepare('SELECT time, type, title FROM character_offline_trade WHERE charId=? LIMIT 1');
    $st->bind_param('i', $cid);
    $st->execute();
    $offline = $st->get_result()->fetch_assoc() ?: null;
    $tradeListings = [];
    $tradeSales = [];
    $tradeSoldSum = 0;
    $tradeSoldQty = 0;
    if ($offline) {
        $tradeListings = l2_trade_listings($conn, $cid, (int) $offline['type']);
    }
    $tradeSales = l2_trade_sales($conn, $cid, 30);
    foreach ($tradeSales as $sale) {
        $tradeSoldSum += (int) $sale['total'];
        $tradeSoldQty += (int) $sale['qty'];
    }
    $st = $conn->prepare(
        'SELECT c.char_name, c.level, c.online, c.classid
         FROM character_friends f
         JOIN characters c ON c.charId = f.friendId
         WHERE f.charId=?
         ORDER BY c.online DESC, c.char_name ASC
         LIMIT 40'
    );
    $st->bind_param('i', $cid);
    $st->execute();
    $r = $st->get_result();
    while ($row = $r->fetch_assoc()) {
        $friends[] = $row;
    }
}

function fNum($n)
{
    return number_format((float) $n, 0, ',', ' ');
}
function fTimeSec($s)
{
    $s = max(0, (int) $s);
    $d = intdiv($s, 86400);
    $h = intdiv($s % 86400, 3600);
    $m = intdiv($s % 3600, 60);
    if ($d > 0) {
        return $d . 'd ' . $h . 'h';
    }
    return $h . 'h ' . $m . 'm';
}
function fWhenMs($ms)
{
    $ms = (int) $ms;
    if ($ms < 100000) {
        return '—';
    }
    return date('Y-m-d H:i', (int) ($ms / 1000));
}
function pct($cur, $max)
{
    $max = (float) $max;
    if ($max <= 0) {
        return 0;
    }
    return max(0, min(100, round(((float) $cur / $max) * 100)));
}

$accPvp = 0;
$accPk = 0;
$accTime = 0;
$accOnline = 0;
foreach ($chars as $c) {
    $accPvp += (int) $c['pvpkills'];
    $accPk += (int) $c['pkkills'];
    $accTime += (int) $c['onlinetime'];
    if ((int) $c['online'] === 1) {
        $accOnline++;
    }
}

$vit = $active ? getVitalityInfo($active['vitality_points']) : null;
$offlineHint = ((int) ($active['online'] ?? 0) === 1);

require_once __DIR__ . '/../templates/header.php';
?>
<style>
.np { max-width: 1220px; margin: 28px auto 88px; padding: 0 20px; color: #c9c9d0; }
.np-top { display: grid; grid-template-columns: 1.35fr .85fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 900px) { .np-top, .np-layout { grid-template-columns: 1fr !important; } }
.np-card {
  background: linear-gradient(180deg, #16181f 0%, #101218 100%) !important;
  border: 1px solid rgba(255,255,255,.07) !important;
  border-radius: 16px; padding: 22px 24px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 16px 36px rgba(0,0,0,.42) !important;
  backdrop-filter: blur(18px) saturate(110%);
  transform: none !important;
}
.np-card::before { display: none !important; }
.np-card:hover { border-color: rgba(201,162,39,.22) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 16px 36px rgba(0,0,0,.45) !important; transform: none !important; }
.np-k { font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; color: #7a7a84; }
.np-v { font-family: Cinzel, Georgia, serif; font-size: 1.45rem; color: #f3f3f5; margin-top: 4px; font-weight: 600; }
.np-gold { color: #d4c08a; }
.np-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.np-chip { font-size: .76rem; padding: 5px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08); color: #b0b0b8; background: rgba(255,255,255,.03); box-shadow: none !important; }
.np-chip.on { border-color: rgba(201,162,39,.32); color: #d8c48a; background: rgba(201,162,39,.08); }
.np-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.np-actions a, .np-actions button { display: inline-block; padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); color: #d2d2d8; text-decoration: none; background: #17191f; font-size: .82rem; cursor: pointer; box-shadow: none; overflow: visible; }
.np-actions a:hover, .np-actions button:hover:not(:disabled) { border-color: rgba(201,162,39,.4); color: #e8d9a4; background: #1c1e26; }
.np-actions button:disabled, .np-sel:disabled { opacity: .45; cursor: not-allowed; }
.np-flash { margin-bottom: 16px; padding: 12px 16px; border-radius: 12px; }
.np-flash.ok { background: rgba(80,140,90,.12); border: 1px solid rgba(90,160,100,.35); color: #b5d4ba; }
.np-flash.err { background: rgba(140,50,50,.12); border: 1px solid rgba(160,70,70,.35); color: #e0b0b0; }
.np-layout { display: grid; grid-template-columns: 270px 1fr; gap: 18px; }
.np-char { display: flex; gap: 12px; align-items: center; padding: 11px 12px; border-radius: 12px; border: 1px solid transparent; color: inherit; text-decoration: none; margin-bottom: 8px; background: rgba(255,255,255,.03); }
.np-char:hover { border-color: rgba(255,255,255,.1); }
.np-char.active { border-color: rgba(201,162,39,.35); background: rgba(201,162,39,.07); }
.np-dot { width: 8px; height: 8px; border-radius: 50%; background: #3a3d46; flex-shrink: 0; }
.np-dot.on { background: #7fa888; box-shadow: none; }
.np-name { font-weight: 650; color: #f3f3f5; }
.np-meta { font-size: .78rem; color: #8a8a94; }
.np-hero h1 { font-family: Cinzel, Georgia, serif; font-size: 1.85rem; margin: 0 0 6px; color: #f3f3f5; letter-spacing: .02em; font-weight: 600; }
.np-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 10px; margin: 16px 0; }
.np-stat { background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.05); border-radius: 12px; padding: 12px 10px; text-align: center; }
.np-stat b { display: block; font-size: 1.08rem; color: #f0f0f3; margin-top: 4px; }
.np-bar { height: 7px; background: #0c0d11; border-radius: 8px; overflow: hidden; margin-top: 6px; box-shadow: inset 0 1px 3px rgba(0,0,0,.55); }
.np-bar > i { display: block; height: 100%; box-shadow: none; }
.np-hp { background: linear-gradient(180deg, #8a4545, #5c2e2e); }
.np-mp { background: linear-gradient(180deg, #3d5a86, #2a3f5e); }
.np-cp { background: linear-gradient(180deg, #8a7a48, #5c5230); }
.np-vt { background: linear-gradient(180deg, #4f6a48, #354832); }
.np-vital { margin: 8px 0 12px; }
.np-vital label { font-size: .75rem; color: #888; }
.np-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.np-table td, .np-table th { padding: 9px 6px; border-bottom: 1px solid rgba(255,255,255,.06); text-align: left; }
.np-table th { color: #777; font-weight: 600; font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
.np-note { color: #7a7a84; font-size: .84rem; line-height: 1.55; margin-top: 12px; }
.np-sel { background: #111; color: #ddd; border: 1px solid #444; padding: 8px 10px; border-radius: 10px; }
.np-sec { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,.06); }
.np-sec h2 { font-family: Cinzel, Georgia, serif; font-size: 1rem; color: #c4b07a; margin: 0 0 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 600; }
.np-friends { display: flex; flex-wrap: wrap; gap: 8px; }
.np-friend { font-size: .8rem; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06); }
.np-friend.on { border-color: rgba(127,168,136,.4); }
</style>

<script>document.documentElement.setAttribute("data-patron","<?= $isPremium ? '1' : '0' ?>");</script>
<div class="np">
    <?php if ($flash): ?>
        <div class="np-flash <?= $flashType === 'err' ? 'err' : 'ok' ?>"><?= htmlspecialchars($flash) ?></div>
    <?php endif; ?>

    <div class="np-top">
        <div class="np-card">
            <div class="np-k">Konto</div>
            <div class="np-v"><?= htmlspecialchars(strtoupper($user)) ?></div>
            <div class="np-row">
                <span class="np-chip <?= $isPremium ? 'on' : '' ?>"><?= $isPremium ? 'Patron Fundamentu' : 'Standard' ?></span>
                <?php if ($isPremium): ?>
                    <span class="np-chip on">EXP/SP x1.1 · <?= fTimeSec($premLeft) ?></span>
                    <span class="np-chip">Drop/Spoil x1</span>
                    <span class="np-chip">do <?= fWhenMs($premEnd) ?></span>
                <?php else: ?>
                    <span class="np-chip">EXP/SP x1</span>
                <?php endif; ?>
                <?php if ($accOnline): ?>
                    <span class="np-chip on"><?= $accOnline ?> online</span>
                <?php endif; ?>
            </div>
            <div class="np-actions" style="margin-top:16px">
                <a href="/password.php">Hasło</a>
                <a href="/shop.php">Patron 30 NC / 30 dni</a>
                <a href="/donate.php">Doładuj NC</a>
                <a href="/transfer.php">Coin of Luck do gry</a>
                <a href="/history.php">Historia</a>
            </div>
        </div>
        <div class="np-card">
            <div class="np-k">Portfel NC Coins</div>
            <div class="np-v np-gold"><?= fNum($wallet) ?></div>
            <div class="np-row">
                <span class="np-chip">Postacie: <?= count($chars) ?></span>
                <span class="np-chip">PvP <?= fNum($accPvp) ?></span>
                <span class="np-chip">PK <?= fNum($accPk) ?></span>
                <span class="np-chip"><?= fTimeSec($accTime) ?> w świecie</span>
            </div>
            <p class="np-note">1 NC = 1 PLN. 1 NC = 1 Coin of Luck. Odbierz u Aurelii (Clarissa, Giran) albo u Dimensional Merchant — „Odbierz przedmiot wymiarowy”.</p>
        </div>
    </div>

    <?php if (!$chars): ?>
        <div class="np-card">Brak postaci na koncie. Załóż postać w kliencie gry.</div>
    <?php else: ?>
    <div class="np-layout">
        <aside class="np-card">
            <div class="np-k" style="margin-bottom:10px">Postacie</div>
            <?php foreach ($chars as $c): ?>
                <a class="np-char <?= ((int) $c['charId'] === $activeId) ? 'active' : '' ?>" href="/panel.php?char_id=<?= (int) $c['charId'] ?>">
                    <span class="np-dot <?= ((int) $c['online'] === 1) ? 'on' : '' ?>"></span>
                    <div>
                        <div class="np-name"><?= htmlspecialchars($c['char_name']) ?></div>
                        <div class="np-meta"><?= (int) $c['level'] ?> · <?= htmlspecialchars(getClassName((int) $c['classid'])) ?><?php if (isset($accountTrades[(int) $c['charId']])): ?> · trade<?php endif; ?></div>
                    </div>
                </a>
            <?php endforeach; ?>
        </aside>

        <?php if ($active): $ac = $active; ?>
        <section class="np-card np-hero">
            <div class="np-k"><?= ((int) $ac['online'] === 1) ? 'W grze' : 'Offline' ?> · <?= htmlspecialchars(getTownName((int) $ac['x'], (int) $ac['y'])) ?></div>
            <h1><?= htmlspecialchars($ac['char_name']) ?></h1>
            <div class="np-meta">
                <?= htmlspecialchars(getRaceName((int) $ac['race'])) ?>
                · <?= ((int) $ac['sex'] === 1) ? 'Kobieta' : 'Mężczyzna' ?>
                · <?= htmlspecialchars(getClassName((int) $ac['classid'])) ?>
                <?php if (!empty($ac['clan_name'])): ?> · Klan <?= htmlspecialchars($ac['clan_name']) ?> (Lv <?= (int) $ac['clan_level'] ?>)<?php endif; ?>
                <?php if (!empty($ac['ally_name'])): ?> · Ally <?= htmlspecialchars($ac['ally_name']) ?><?php endif; ?>
                <?php if ((int) $ac['hasCastle']): ?> · Zamek<?php endif; ?>
                <?php if ((int) $ac['nobless']): ?> · Noblesse<?php endif; ?>
                <?php if ($isHero): ?> · Hero<?php endif; ?>
                <?php if ($offline): ?> · Offline trade: <?= htmlspecialchars(getStoreTypeName($offline['type'])) ?><?php endif; ?>
                <?php if (!empty($ac['title'])): ?> · „<?= htmlspecialchars($ac['title']) ?>”<?php endif; ?>
            </div>

            <div class="np-vital">
                <label>HP <?= fNum($ac['curHp']) ?> / <?= fNum($ac['maxHp']) ?></label>
                <div class="np-bar"><i class="np-hp" style="width:<?= pct($ac['curHp'], $ac['maxHp']) ?>%"></i></div>
            </div>
            <div class="np-vital">
                <label>MP <?= fNum($ac['curMp']) ?> / <?= fNum($ac['maxMp']) ?></label>
                <div class="np-bar"><i class="np-mp" style="width:<?= pct($ac['curMp'], $ac['maxMp']) ?>%"></i></div>
            </div>
            <div class="np-vital">
                <label>CP <?= fNum($ac['curCp']) ?> / <?= fNum($ac['maxCp']) ?></label>
                <div class="np-bar"><i class="np-cp" style="width:<?= pct($ac['curCp'], $ac['maxCp']) ?>%"></i></div>
            </div>
            <?php if ($vit): ?>
            <div class="np-vital">
                <label>Vitality <?= fNum($ac['vitality_points']) ?> / 20 000 · stopień <?= (int) $vit['stopień'] ?> · <?= htmlspecialchars($vit['mnożnik']) ?></label>
                <div class="np-bar"><i class="np-vt" style="width:<?= (int) $vit['pct'] ?>%"></i></div>
            </div>
            <?php endif; ?>

            <div class="np-grid">
                <div class="np-stat"><span class="np-k">Poziom</span><b><?= (int) $ac['level'] ?></b></div>
                <div class="np-stat"><span class="np-k">EXP</span><b><?= fNum($ac['exp']) ?></b></div>
                <div class="np-stat"><span class="np-k">SP</span><b><?= fNum($ac['sp']) ?></b></div>
                <div class="np-stat"><span class="np-k">Adena</span><b class="np-gold"><?= fNum($adena) ?></b></div>
                <div class="np-stat"><span class="np-k">Magazyn Adena</span><b class="np-gold"><?= fNum($whAdena) ?></b></div>
                <div class="np-stat"><span class="np-k">PvP</span><b><?= (int) $ac['pvpkills'] ?></b></div>
                <div class="np-stat"><span class="np-k">PK</span><b><?= (int) $ac['pkkills'] ?></b></div>
                <div class="np-stat"><span class="np-k">Karma</span><b><?= (int) $ac['karma'] ?></b></div>
                <div class="np-stat"><span class="np-k">Fame</span><b><?= fNum($ac['fame']) ?></b></div>
                <div class="np-stat"><span class="np-k">Raid pts</span><b><?= fNum($raidPts) ?></b></div>
                <div class="np-stat"><span class="np-k">PC Cafe</span><b><?= fNum($ac['pccafe_points']) ?></b></div>
                <div class="np-stat"><span class="np-k">Ekwipunek</span><b><?= $invCount ?></b></div>
                <div class="np-stat"><span class="np-k">Magazyn</span><b><?= $whCount ?></b></div>
                <div class="np-stat"><span class="np-k">Recepty</span><b><?= $recipes ?></b></div>
                <div class="np-stat"><span class="np-k">My Teleport</span><b><?= $bookmarks ?> / <?= max(0, (int) $ac['bookmarkslot']) ?></b></div>
                <div class="np-stat"><span class="np-k">Henna</span><b><?= $hennas ?> / 3</b></div>
                <div class="np-stat"><span class="np-k">Czas gry</span><b><?= fTimeSec($ac['onlinetime']) ?></b></div>
                <?php if (!empty($ac['clan_name'])): ?>
                <div class="np-stat"><span class="np-k">Clan rep</span><b><?= fNum($ac['reputation_score']) ?></b></div>
                <?php endif; ?>
            </div>

            <?php if ($oly): ?>
                <p class="np-note" style="color:#ccc">Olympiad: <?= fNum($oly['olympiad_points']) ?> pkt · <?= (int) $oly['competitions_won'] ?>W / <?= (int) $oly['competitions_lost'] ?>L / <?= (int) $oly['competitions_drawn'] ?>D · łącznie <?= (int) $oly['competitions_done'] ?></p>
            <?php endif; ?>

            <?php if ($pending): ?>
                <div class="np-sec">
                    <h2>Oczekujące przedmioty wymiarowe</h2>
                    <table class="np-table">
                        <tr><th>Przedmiot</th><th>Ilość</th><th>Nadawca</th></tr>
                        <?php foreach ($pending as $p): ?>
                            <tr>
                                <td><?= htmlspecialchars(getItemName($p['itemId'])) ?></td>
                                <td><?= fNum($p['itemCount']) ?></td>
                                <td><?= htmlspecialchars((string) $p['itemSender']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                    <p class="np-note" style="color:#d4af37">Relog → Aurelia / Dimensional Merchant → Odbierz przedmiot wymiarowy.<?= $pendingCol ? ' W tym Coin of Luck: ' . fNum($pendingCol) . '.' : '' ?></p>
                </div>
            <?php endif; ?>

            <?php if ($eq): ?>
                <div class="np-sec">
                    <h2>Założony ekwipunek</h2>
                    <table class="np-table">
                        <tr><th>Slot</th><th>Przedmiot</th><th>Enchant</th></tr>
                        <?php foreach ($eq as $e): ?>
                            <tr>
                                <td><?= htmlspecialchars(getPaperdollSlotName($e['loc_data'])) ?></td>
                                <td><?= htmlspecialchars(getItemName($e['item_id'])) ?></td>
                                <td><?= ((int) $e['enchant_level'] > 0) ? ('+' . (int) $e['enchant_level']) : '—' ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>

            <?php if ($subs): ?>
                <div class="np-sec">
                    <h2>Klasy</h2>
                    <table class="np-table">
                        <tr><th>Klasa</th><th>Lv</th><th>EXP</th><th>SP</th></tr>
                        <?php foreach ($subs as $s): ?>
                            <tr>
                                <td><?= htmlspecialchars(getClassName((int) $s['class_id'])) ?><?= ((int) $s['class_id'] === (int) $ac['classid']) ? ' · aktywna' : '' ?></td>
                                <td><?= (int) $s['level'] ?></td>
                                <td><?= fNum($s['exp']) ?></td>
                                <td><?= fNum($s['sp']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            <?php endif; ?>

            <?php if ($friends): ?>
                <div class="np-sec">
                    <h2>Przyjaciele (<?= count($friends) ?>)</h2>
                    <div class="np-friends">
                        <?php foreach ($friends as $f): ?>
                            <span class="np-friend <?= ((int) $f['online'] === 1) ? 'on' : '' ?>">
                                <?= htmlspecialchars($f['char_name']) ?> · <?= (int) $f['level'] ?> <?= htmlspecialchars(getClassName((int) $f['classid'])) ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <div class="np-sec">
                <h2>Offline trade</h2>
                <?php if ($offline): ?>
                    <div class="np-row" style="margin-top:0">
                        <span class="np-chip on"><?= htmlspecialchars(getStoreTypeName($offline['type'])) ?></span>
                        <span class="np-chip">od <?= fTimeSec((int) ((microtime(true) * 1000 - (int) $offline['time']) / 1000)) ?></span>
                        <span class="np-chip">Adena <?= fNum($adena) ?></span>
                        <?php if (!empty($offline['title'])): ?><span class="np-chip">„<?= htmlspecialchars($offline['title']) ?>”</span><?php endif; ?>
                    </div>
                    <table class="np-table" style="margin-top:12px">
                        <tr><th>Przedmiot</th><th>+</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr>
                        <?php foreach ($tradeListings as $l): ?>
                            <tr>
                                <td><?= htmlspecialchars($l['name']) ?></td>
                                <td><?= $l['enchant'] ? ('+' . (int) $l['enchant']) : '—' ?></td>
                                <td><?= fNum($l['qty']) ?></td>
                                <td class="np-gold"><?= fNum($l['price']) ?></td>
                                <td><?= fNum($l['total']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        <?php if (!$tradeListings): ?>
                            <tr><td colspan="5">Lada pusta.</td></tr>
                        <?php endif; ?>
                    </table>
                <?php else: ?>
                    <p class="np-note" style="margin-top:0">Ta postać teraz nie stoi na .offline. Rynek świata: <a href="/market.php" style="color:#d4af37">market.php</a></p>
                <?php endif; ?>
                <p class="np-note">Sprzedane (zarejestrowane): <?= fNum($tradeSoldQty) ?> szt. · <?= fNum($tradeSoldSum) ?> Adena</p>
                <?php if ($tradeSales): ?>
                    <table class="np-table">
                        <tr><th>Kiedy</th><th>Przedmiot</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr>
                        <?php foreach ($tradeSales as $sale): ?>
                            <tr>
                                <td><?= htmlspecialchars((string) $sale['sold_at']) ?></td>
                                <td><?= htmlspecialchars($sale['item_name']) ?><?= ((int) $sale['enchant'] > 0) ? (' +' . (int) $sale['enchant']) : '' ?></td>
                                <td><?= fNum($sale['qty']) ?></td>
                                <td><?= fNum($sale['price']) ?></td>
                                <td class="np-gold"><?= fNum($sale['total']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </table>
                <?php endif; ?>
            </div>

            <div class="np-sec">
                <h2>Zarządzanie postacią</h2>
                <p class="np-note">Działa wyłącznie gdy postać jest wylogowana. Nie zmienia ekwipunku, poziomu ani PK. Teleport do miasta jest tylko u Gatekeepera (płatny).</p>
                <form method="post" class="np-actions" style="margin-top:12px">
                    <input type="hidden" name="char_id" value="<?= (int) $ac['charId'] ?>">
                    <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>">
                    <button type="submit" name="restore_vitals" value="1" <?= $offlineHint ? 'disabled' : '' ?>>
                        <?= $offlineHint ? 'Wyloguj, by przywrócić HP/MP/CP' : 'Przywróć HP / MP / CP' ?>
                    </button>
                </form>
            </div>

            <p class="np-note">Ostatnie logowanie: <?= fWhenMs($ac['lastAccess']) ?> · Utworzona: <?= htmlspecialchars((string) $ac['createDate']) ?> · Bazowa: <?= htmlspecialchars(getClassName((int) $ac['base_class'])) ?> · Wygląd: twarz <?= (int) $ac['face'] ?>, włosy <?= (int) $ac['hairStyle'] ?>/<?= (int) $ac['hairColor'] ?><?= ((int) $ac['cancraft'] === 1) ? ' · Craft' : '' ?></p>
        </section>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>
<div style="max-width:980px;margin:0 auto;padding:0 18px 40px">
    <?php require __DIR__ . '/../templates/rates_board.php'; ?>
</div>
<?php require_once __DIR__ . '/../templates/footer.php'; ?>
