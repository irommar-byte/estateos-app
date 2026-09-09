<?php
require_once __DIR__ . '/includes/Lang.php';
if (is_file(__DIR__ . '/includes/l2_functions.php')) {
    require_once __DIR__ . '/includes/l2_functions.php';
}
require_once __DIR__ . '/../templates/header.php';

$race_map = [0 => 'human', 1 => 'elf', 2 => 'darkelf', 3 => 'orc', 4 => 'dwarf', 5 => 'kamael'];
$view = isset($_GET['view']) ? (string) $_GET['view'] : 'pvp';

$page_config = [
    'pvp' => ['title' => 'PvP', 'subtitle' => 'Walka gracz kontra gracz', 'stat' => 'PvP / PK', 'kind' => 'player'],
    'pk' => ['title' => 'PK', 'subtitle' => 'Największy rozbój w Adenie', 'stat' => 'PK', 'kind' => 'player'],
    'level' => ['title' => 'Poziom', 'subtitle' => 'Najwyższy poziom i EXP', 'stat' => 'Level', 'kind' => 'player'],
    'fame' => ['title' => 'Fame', 'subtitle' => 'Sława na polach bitwy', 'stat' => 'Fame', 'kind' => 'player'],
    'oly' => ['title' => 'Olympiad', 'subtitle' => 'Noblesse — punkty sezonu', 'stat' => 'Punkty', 'kind' => 'player'],
    'time' => ['title' => 'Czas gry', 'subtitle' => 'Godziny w świecie', 'stat' => 'Czas', 'kind' => 'player'],
    'clan' => ['title' => 'Klany', 'subtitle' => 'Reputacja i siła domu', 'stat' => 'Rep', 'kind' => 'clan'],
    'rich' => ['title' => 'Adena', 'subtitle' => 'Inwentarz + magazyn', 'stat' => 'Adena', 'kind' => 'player'],
    'donate' => ['title' => 'Patroni', 'subtitle' => 'Wsparcie Fundamentu', 'stat' => 'NC', 'kind' => 'player'],
];
if (!isset($page_config[$view])) {
    $view = 'pvp';
}
$cfg = $page_config[$view];

function rkAvatar(array $p): string
{
    global $race_map;
    if (!empty($p['avatar_id']) && is_file(__DIR__ . '/assets/img/avatars/' . $p['avatar_id'])) {
        return 'assets/img/avatars/' . $p['avatar_id'];
    }
    $race = $race_map[$p['race'] ?? 0] ?? 'human';
    return 'assets/img/races/' . $race . '.png';
}
function rkClass($id): string
{
    return function_exists('getClassName') ? getClassName((int) $id) : '';
}
function rkNum($n): string
{
    return number_format((float) $n, 0, ',', ' ');
}
function rkTime($s): string
{
    $s = max(0, (int) $s);
    $d = intdiv($s, 86400);
    $h = intdiv($s % 86400, 3600);
    if ($d > 0) {
        return $d . 'd ' . $h . 'h';
    }
    return $h . 'h ' . intdiv($s % 3600, 60) . 'm';
}
function rkStat(array $p, string $view): string
{
    if ($view === 'pvp') {
        return rkNum($p['pvpkills'] ?? 0) . ' / ' . rkNum($p['pkkills'] ?? 0);
    }
    if ($view === 'pk') {
        return rkNum($p['pkkills'] ?? 0);
    }
    if ($view === 'level') {
        return (int) ($p['level'] ?? 0);
    }
    if ($view === 'fame') {
        return rkNum($p['fame'] ?? 0);
    }
    if ($view === 'oly') {
        return rkNum($p['main_stat'] ?? 0);
    }
    if ($view === 'time') {
        return rkTime($p['onlinetime'] ?? 0);
    }
    if ($view === 'rich' || $view === 'donate') {
        return rkNum($p['main_stat'] ?? 0);
    }
    return rkNum($p['main_stat'] ?? 0);
}

$data = [];
if (isset($conn)) {
    $join = "LEFT JOIN clan_data d ON c.clanid = d.clan_id
             LEFT JOIN web_char_settings w ON c.charId = w.char_id";
    $base = "c.char_name, c.level, c.race, c.online, c.classid, c.pvpkills, c.pkkills, c.fame, c.onlinetime, d.clan_name, w.avatar_id";
    if ($view === 'pvp') {
        $res = $conn->query("SELECT $base FROM characters c $join WHERE c.accesslevel = 0 ORDER BY c.pvpkills DESC, c.level DESC LIMIT 25");
    } elseif ($view === 'pk') {
        $res = $conn->query("SELECT $base FROM characters c $join WHERE c.accesslevel = 0 ORDER BY c.pkkills DESC, c.pvpkills DESC LIMIT 25");
    } elseif ($view === 'level') {
        $res = $conn->query("SELECT $base, c.exp FROM characters c $join WHERE c.accesslevel = 0 ORDER BY c.exp DESC, c.level DESC LIMIT 25");
    } elseif ($view === 'fame') {
        $res = $conn->query("SELECT $base FROM characters c $join WHERE c.accesslevel = 0 ORDER BY c.fame DESC, c.level DESC LIMIT 25");
    } elseif ($view === 'time') {
        $res = $conn->query("SELECT $base FROM characters c $join WHERE c.accesslevel = 0 ORDER BY c.onlinetime DESC LIMIT 25");
    } elseif ($view === 'oly') {
        $res = $conn->query("SELECT $base, o.olympiad_points AS main_stat, o.competitions_won, o.competitions_lost
            FROM olympiad_nobles o
            JOIN characters c ON c.charId = o.charId
            $join
            WHERE c.accesslevel = 0
            ORDER BY o.olympiad_points DESC, o.competitions_won DESC
            LIMIT 25");
    } elseif ($view === 'rich') {
        $res = $conn->query("SELECT $base, SUM(i.count) AS main_stat
            FROM items i
            JOIN characters c ON i.owner_id = c.charId
            $join
            WHERE i.item_id = 57 AND c.accesslevel = 0 AND i.loc IN ('INVENTORY','WAREHOUSE')
            GROUP BY c.charId, c.char_name, c.level, c.race, c.online, c.classid, c.pvpkills, c.pkkills, c.fame, c.onlinetime, d.clan_name, w.avatar_id
            ORDER BY main_stat DESC
            LIMIT 25");
    } elseif ($view === 'donate') {
        $res = $conn->query("SELECT $base, t.account_name, t.total_donated AS main_stat
            FROM (
                SELECT account_name, SUM(ABS(coins)) AS total_donated
                FROM web_donate_logs
                WHERE coins < 0
                GROUP BY account_name
                ORDER BY total_donated DESC
                LIMIT 40
            ) t
            JOIN characters c ON c.account_name = t.account_name
            $join
            WHERE c.accesslevel = 0
            ORDER BY t.total_donated DESC, c.exp DESC");
        $seen = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $acc = $row['account_name'] ?? $row['char_name'];
                if (isset($seen[$acc])) {
                    continue;
                }
                $seen[$acc] = true;
                $data[] = $row;
                if (count($data) >= 25) {
                    break;
                }
            }
        }
        $res = null;
    } elseif ($view === 'clan') {
        $res = $conn->query("SELECT d.clan_id, d.clan_name, d.clan_level, d.reputation_score AS main_stat,
                d.hasCastle, d.ally_name, ldr.char_name AS leader, COUNT(m.charId) AS members
            FROM clan_data d
            LEFT JOIN characters ldr ON ldr.charId = d.leader_id
            LEFT JOIN characters m ON m.clanid = d.clan_id
            WHERE d.clan_id > 0
            GROUP BY d.clan_id, d.clan_name, d.clan_level, d.reputation_score, d.hasCastle, d.ally_name, ldr.char_name
            ORDER BY d.reputation_score DESC, d.clan_level DESC, members DESC
            LIMIT 25");
    }
    if (!empty($res)) {
        while ($row = $res->fetch_assoc()) {
            $data[] = $row;
        }
    }
}
$top3 = array_slice($data, 0, 3);
$rest = array_slice($data, 3);
$tabs = [
    'pvp' => 'PvP',
    'pk' => 'PK',
    'level' => 'Level',
    'fame' => 'Fame',
    'oly' => 'Olympiad',
    'time' => 'Czas',
    'clan' => 'Klany',
    'rich' => 'Adena',
    'donate' => 'Patroni',
];
?>
<style>
.rk { max-width: 1120px; margin: 28px auto 80px; color: #c8c8d0; }
.rk-head { margin-bottom: 22px; }
.rk-k { font-size: .68rem; letter-spacing: .18em; text-transform: uppercase; color: #7a7a84; margin: 0 0 6px; }
.rk-title { font-family: Cinzel, Georgia, serif; font-size: clamp(1.4rem, 3vw, 2rem); color: #f2f2f4; margin: 0; font-weight: 600; letter-spacing: .04em; white-space: normal; overflow: visible; }
.rk-sub { color: #8a8a94; margin: 8px 0 0; font-size: .95rem; }
.rk-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 22px 0 28px; }
.rk-tabs a { display: inline-block; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); color: #a8a8b0; text-decoration: none; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; background: rgba(255,255,255,.03); }
.rk-tabs a:hover { border-color: rgba(201,162,39,.35); color: #e8d9a4; }
.rk-tabs a.on { background: rgba(201,162,39,.12); border-color: rgba(201,162,39,.4); color: #e8d9a4; }
.rk-podium { display: grid; grid-template-columns: 1fr 1.12fr 1fr; gap: 14px; align-items: stretch; margin-bottom: 28px; }
@media (max-width: 800px) { .rk-podium { grid-template-columns: 1fr; } }
.rk-card { background: linear-gradient(180deg, #16181f, #101218); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 22px 18px 20px; text-align: center; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 14px 32px rgba(0,0,0,.4); }
.rk-card.p1 { border-color: rgba(201,162,39,.28); }
.rk-place { font-size: .72rem; letter-spacing: .16em; text-transform: uppercase; color: #7a7a84; }
.rk-card.p1 .rk-place { color: #d8c48a; }
.rk-ava { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; margin: 12px auto 10px; display: block; border: 1px solid rgba(255,255,255,.1); background: #0c0d12; }
.rk-name { color: #f4f4f6; font-size: 1.15rem; font-weight: 650; }
.rk-clan { color: #8a8a94; font-size: .82rem; margin-top: 4px; }
.rk-score { margin-top: 12px; color: #d8c48a; font-variant-numeric: tabular-nums; font-size: 1.05rem; }
.rk-table { width: 100%; border-collapse: collapse; font-size: .9rem; background: linear-gradient(180deg, #14161c, #101218); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; }
.rk-table th { text-align: left; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: #7a7a84; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.06); font-weight: 600; }
.rk-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.045); vertical-align: middle; }
.rk-table tr:last-child td { border-bottom: 0; }
.rk-table tr:hover td { background: rgba(255,255,255,.025); }
.rk-mini { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid rgba(255,255,255,.08); }
.rk-on { color: #8fbf9a; font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
.rk-off { color: #6a6a72; font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
.rk-empty { padding: 36px; text-align: center; color: #8a8a94; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; background: #12141a; }
</style>

<div class="rk">
    <div class="rk-head">
        <p class="rk-k">Nostalgie™ · ranking</p>
        <h1 class="rk-title"><?= htmlspecialchars($cfg['title']) ?></h1>
        <p class="rk-sub"><?= htmlspecialchars($cfg['subtitle']) ?></p>
    </div>
    <nav class="rk-tabs">
        <?php foreach ($tabs as $key => $label): ?>
            <a class="<?= $view === $key ? 'on' : '' ?>" href="/ranking.php?view=<?= htmlspecialchars($key) ?>"><?= htmlspecialchars($label) ?></a>
        <?php endforeach; ?>
    </nav>

    <?php if (!$data): ?>
        <div class="rk-empty">Brak wpisów na tej liście.</div>
    <?php else: ?>
        <?php if ($cfg['kind'] === 'player' && $top3): ?>
        <div class="rk-podium">
            <?php
            $order = [1, 0, 2];
            foreach ($order as $idx):
                if (!isset($top3[$idx])) {
                    continue;
                }
                $p = $top3[$idx];
                $rank = $idx + 1;
                ?>
            <article class="rk-card <?= $rank === 1 ? 'p1' : '' ?>">
                <div class="rk-place">#<?= $rank ?></div>
                <img class="rk-ava" src="<?= htmlspecialchars(rkAvatar($p)) ?>" alt="">
                <div class="rk-name"><?= htmlspecialchars($p['char_name']) ?></div>
                <div class="rk-clan"><?= htmlspecialchars($p['clan_name'] ?: 'No Clan') ?> · Lv <?= (int) $p['level'] ?></div>
                <div class="rk-score"><?= htmlspecialchars($cfg['stat']) ?> · <?= rkStat($p, $view) ?></div>
            </article>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <table class="rk-table">
            <thead>
                <tr>
                    <th>#</th>
                    <?php if ($cfg['kind'] === 'clan'): ?>
                        <th>Klan</th>
                        <th>Lider</th>
                        <th>Lv</th>
                        <th>Członkowie</th>
                        <th>Reputacja</th>
                    <?php else: ?>
                        <th>Gracz</th>
                        <th>Klasa</th>
                        <th>Lv</th>
                        <th><?= htmlspecialchars($cfg['stat']) ?></th>
                        <th>Status</th>
                    <?php endif; ?>
                </tr>
            </thead>
            <tbody>
            <?php
            $start = ($cfg['kind'] === 'player' && $top3) ? 4 : 1;
            $rows = ($cfg['kind'] === 'player' && $top3) ? $rest : $data;
            $i = $start;
            foreach ($rows as $p):
                ?>
                <tr>
                    <td><?= $i++ ?></td>
                    <?php if ($cfg['kind'] === 'clan'): ?>
                        <td>
                            <b style="color:#f2f2f4"><?= htmlspecialchars($p['clan_name'] ?: '—') ?></b>
                            <?php if (!empty($p['ally_name'])): ?><div class="rk-clan"><?= htmlspecialchars($p['ally_name']) ?></div><?php endif; ?>
                            <?php if (!empty($p['hasCastle'])): ?><div class="rk-clan">Castle</div><?php endif; ?>
                        </td>
                        <td><?= htmlspecialchars($p['leader'] ?: '—') ?></td>
                        <td><?= (int) $p['clan_level'] ?></td>
                        <td><?= (int) $p['members'] ?></td>
                        <td style="color:#d8c48a"><?= rkNum($p['main_stat']) ?></td>
                    <?php else: ?>
                        <td>
                            <img class="rk-mini" src="<?= htmlspecialchars(rkAvatar($p)) ?>" alt="">
                            <span style="color:#f2f2f4"><?= htmlspecialchars($p['char_name']) ?></span>
                            <?php if (!empty($p['clan_name'])): ?><span class="rk-clan"> [<?= htmlspecialchars($p['clan_name']) ?>]</span><?php endif; ?>
                        </td>
                        <td><?= htmlspecialchars(rkClass($p['classid'] ?? 0)) ?></td>
                        <td><?= (int) ($p['level'] ?? 0) ?></td>
                        <td style="color:#d8c48a"><?= rkStat($p, $view) ?><?php if ($view === 'oly' && isset($p['competitions_won'])): ?> <span class="rk-clan"><?= (int) $p['competitions_won'] ?>W / <?= (int) $p['competitions_lost'] ?>L</span><?php endif; ?></td>
                        <td><?= !empty($p['online']) ? '<span class="rk-on">online</span>' : '<span class="rk-off">offline</span>' ?></td>
                    <?php endif; ?>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>
<?php require_once __DIR__ . '/../templates/footer.php'; ?>
