<?php
require_once __DIR__ . '/../app/config.php';
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/includes/trade_lib.php';

l2_trade_sync($conn);
$shops = l2_trade_shops($conn);
$stats = l2_trade_stats($conn);

function fmtAdena($n) { return number_format((float) $n, 0, ',', ' '); }
function fmtDur($ms) {
    $s = max(0, (int) floor($ms / 1000));
    $d = intdiv($s, 86400);
    $h = intdiv($s % 86400, 3600);
    $m = intdiv($s % 3600, 60);
    if ($d) return $d . 'd ' . $h . 'h';
    return $h . 'h ' . $m . 'm';
}

require_once __DIR__ . '/../templates/header.php';
?>
<style>
.mk { max-width: 1180px; margin: 28px auto 80px; padding: 0 20px; }
.mk-hero { text-align: center; margin-bottom: 28px; }
.mk-hero h1 { font-family: Cinzel, Georgia, serif; color: #f3d98a; letter-spacing: .14em; margin: 0 0 8px; }
.mk-hero p { color: #9a8f7c; }
.mk-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 22px; }
.mk-shop { margin-bottom: 16px; }
.mk-shop h2 { font-family: Cinzel, Georgia, serif; margin: 0 0 6px; color: #fff; font-size: 1.35rem; }
.np-card { padding: 22px 24px; border-radius: 18px; margin-bottom: 8px; }
.np-k { font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; color: #7a7a82; }
.np-gold { color: #d4af37; }
.np-meta { font-size: .78rem; color: #8a8a92; }
.np-note { color: #777; font-size: .84rem; line-height: 1.55; margin-top: 12px; }
.np-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.np-chip { font-size: .76rem; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.1); color: #bbb; }
.np-chip.on { border-color: rgba(212,175,55,.5); color: #d4af37; }
.np-stat { text-align: center; padding: 16px 10px; }
.np-stat b { display: block; font-size: 1.15rem; color: #fff; margin-top: 4px; }
.np-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.np-table td, .np-table th { padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,.06); text-align: left; }
.np-table th { color: #777; font-weight: 600; font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
</style>
<div class="mk">
  <div class="mk-hero">
    <h1>RYNEK OFFLINE</h1>
    <p>Sklepy stojące na komendzie .offline w strefie pokoju. Czas i oferty biorą się z serwera na żywo.</p>
  </div>
  <div class="mk-kpis">
    <div class="np-stat np-card"><span class="np-k">Sklepy</span><b><?= (int) $stats['shops'] ?></b></div>
    <div class="np-stat np-card"><span class="np-k">Wartość ofert</span><b class="np-gold"><?= fmtAdena($stats['listed_value']) ?></b></div>
    <div class="np-stat np-card"><span class="np-k">Adena u traderów</span><b class="np-gold"><?= fmtAdena($stats['trader_adena']) ?></b></div>
    <div class="np-stat np-card"><span class="np-k">Sprzedaż 24h</span><b class="np-gold"><?= fmtAdena($stats['sold_day']) ?></b></div>
    <div class="np-stat np-card"><span class="np-k">Sprzedaż 7 dni</span><b class="np-gold"><?= fmtAdena($stats['sold_week']) ?></b></div>
    <div class="np-stat np-card"><span class="np-k">Najdłuższy shop</span><b><?= fmtDur($stats['longest_ms']) ?></b></div>
  </div>

  <?php if (!$shops): ?>
    <div class="np-card">Nikt teraz nie stoi na offline trade. W grze: strefa pokoju, prywatny sklep, komenda <b>.offline</b>.</div>
  <?php endif; ?>

  <?php foreach ($shops as $s): ?>
    <article class="np-card mk-shop">
      <div class="np-k"><?= htmlspecialchars($s['type_name']) ?> · <?= htmlspecialchars($s['town']) ?> · <?= fmtDur($s['uptime_ms']) ?></div>
      <h2><?= htmlspecialchars($s['char_name']) ?> <span class="np-meta">Lv <?= (int) $s['level'] ?> <?= htmlspecialchars($s['class_name']) ?></span></h2>
      <?php if ($s['title']): ?><p class="np-meta">„<?= htmlspecialchars($s['title']) ?>”</p><?php endif; ?>
      <div class="np-row">
        <span class="np-chip on">Adena <?= fmtAdena($s['adena']) ?></span>
        <span class="np-chip">Oferty <?= (int) $s['slots'] ?></span>
        <span class="np-chip">Na ladzie <?= fmtAdena($s['listed_value']) ?></span>
      </div>
      <table class="np-table" style="margin-top:12px">
        <tr><th>Przedmiot</th><th>+</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr>
        <?php foreach ($s['listings'] as $l): ?>
          <tr>
            <td><?= htmlspecialchars($l['name']) ?></td>
            <td><?= $l['enchant'] ? ('+' . (int) $l['enchant']) : '—' ?></td>
            <td><?= fmtAdena($l['qty']) ?></td>
            <td class="np-gold"><?= fmtAdena($l['price']) ?></td>
            <td><?= fmtAdena($l['total']) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$s['listings']): ?>
          <tr><td colspan="5">Pusta lada (sklep zaraz się zamknie).</td></tr>
        <?php endif; ?>
      </table>
    </article>
  <?php endforeach; ?>

  <?php if ($stats['top']): ?>
    <div class="np-card">
      <div class="np-k" style="margin-bottom:10px">Najwięksi sprzedawcy (zarejestrowane transakcje)</div>
      <table class="np-table">
        <tr><th>Postać</th><th>Sztuki</th><th>Adena</th></tr>
        <?php foreach ($stats['top'] as $t): ?>
          <tr>
            <td><?= htmlspecialchars($t['char_name']) ?></td>
            <td><?= fmtAdena($t['qty']) ?></td>
            <td class="np-gold"><?= fmtAdena($t['adena']) ?></td>
          </tr>
        <?php endforeach; ?>
      </table>
      <p class="np-note">Historia sprzedaży powstaje, gdy oferta w sklepie maleje (item kupiony). Zamknięcie sklepu nie liczy się jako sprzedaż.</p>
    </div>
  <?php endif; ?>
</div>
<?php require_once __DIR__ . '/../templates/footer.php'; ?>
