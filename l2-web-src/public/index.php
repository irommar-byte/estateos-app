<?php
$cssHome = __DIR__ . '/assets/css/home-cinematic.css';
$jsHome = __DIR__ . '/assets/js/home-hero.js';
$vHome = (is_file($cssHome) ? filemtime($cssHome) : 1) . '.' . (is_file($jsHome) ? filemtime($jsHome) : 1);
$extra_head = '<link rel="stylesheet" href="/assets/css/home-cinematic.css?v=' . $vHome . '">'
    . '<script defer src="/assets/js/home-hero.js?v=' . $vHome . '"></script>';

require_once __DIR__ . '/../templates/header.php';

$counterFile = __DIR__ . '/.visits_public';
if (!file_exists($counterFile)) {
    file_put_contents($counterFile, '0');
}
$visits_public = (int) file_get_contents($counterFile);
$visits_public++;
file_put_contents($counterFile, (string) $visits_public);

$season_live = time() >= strtotime('2026-03-16 18:00:00');

$server_online = false;
$fp = @fsockopen('127.0.0.1', 7777, $errno, $errstr, 0.5);
if ($fp) {
    $server_online = true;
    fclose($fp);
}

$players_online = 0;
if (isset($conn) && !$conn->connect_error) {
    $q = $conn->query('SELECT COUNT(*) AS cnt FROM characters WHERE online = 1');
    if ($q && ($row = $q->fetch_assoc())) {
        $players_online = (int) $row['cnt'];
    }
}
?>

<div class="nc-page">
  <div class="nc-ambient" aria-hidden="true"></div>

  <section class="home-cinematic simple-hero nc-hero" aria-label="Nostalgie">

    <div class="nc-logo-stage">
      <div class="nc-logo-glow" aria-hidden="true"></div>
      <div class="home-logo-wrap">
        <a href="/" class="logo-anim-box" aria-label="Nostalgie — strona główna">
          <img src="/assets/img/l2nos.png" alt="Lineage II Nostalgie" width="440" height="293" decoding="async">
        </a>
      </div>
    </div>

    <div class="nc-hero-copy nc-reveal nc-d1">
      <?php if ($season_live): ?>
        <div class="nc-eyebrow"><span class="nc-pulse" aria-hidden="true"></span> Sezon I · Na żywo</div>
      <?php endif; ?>
      <h1 class="nc-headline home-opening epic-date">
        <?php if ($season_live): ?>
          Powrót do prawdziwego <span class="nc-live-word">Lineage II</span>
        <?php else: ?>
          Grand Opening — <span class="nc-live-word">16 marca</span>
        <?php endif; ?>
      </h1>
      <p class="nc-subhead hero-tagline">
        Top Gear i shoty D+ tylko z Craftu · Płatny Teleport · Profesje przez Quest
        <span class="nc-subhead-accent hero-tagline-accent">Ekonomia craftowa bez pay-to-win.</span>
      </p>
    </div>

    <div class="nc-stats-row nc-reveal nc-d2">
      <div class="nc-stat-card">
        <span class="nc-stat-label">Status</span>
        <span class="nc-stat-value <?php echo $server_online ? 'online' : ''; ?>" id="hero-status-text"><?php echo $server_online ? 'Online' : 'Offline'; ?></span>
      </div>
      <div class="nc-stat-card">
        <span class="nc-stat-label">Graczy online</span>
        <span class="nc-stat-value gold" id="hero-players"><?php echo $players_online; ?></span>
      </div>
      <div class="nc-stat-card">
        <span class="nc-stat-label">Wizyty</span>
        <span class="nc-stat-value"><?php echo number_format($visits_public, 0, ',', ' '); ?></span>
      </div>
    </div>

    <!-- hidden for JS compat -->
    <div class="real-status-hud" aria-hidden="true" style="display:none">
      <span class="status-dot <?php echo $server_online ? 'online' : 'offline'; ?>" id="hero-status-dot"></span>
    </div>

    <div class="nc-reveal nc-d3" style="width:min(860px,100%)">
      <?php require __DIR__ . '/../templates/rates_board.php'; ?>
    </div>

    <div class="nc-features nc-reveal nc-d4">
      <article class="nc-feature-card">
        <span class="nc-feature-icon" aria-hidden="true">01</span>
        <h3>Prawdziwy progres</h3>
        <p>Guide buffuje tylko na start (6–27, taper od 21). Shoty D+ i top gear z craftu, nie z lady.</p>
      </article>
      <article class="nc-feature-card">
        <span class="nc-feature-icon" aria-hidden="true">02</span>
        <h3>Nowoczesna infrastruktura</h3>
        <p>Offline trade, launcher z auto-update i weryfikacją SHA256 manifestu.</p>
      </article>
      <article class="nc-feature-card">
        <span class="nc-feature-icon" aria-hidden="true">03</span>
        <h3>High Five</h3>
        <p>Chronicle High Five — L2J Mobius CT 2.6. Klasyczne tempo, nowoczesna stabilność.</p>
      </article>
    </div>

    <?php if ($season_live): ?>
      <p class="nc-season-note nc-reveal nc-d5">Sezon I · Top 3 klany w Hall of Fame</p>
    <?php endif; ?>

    <?php if (!$season_live): ?>
    <div id="countdown" class="home-countdown nc-reveal nc-d5" aria-label="Status sezonu">
      <div class="cd-box"><span id="days">00</span><small>Dni</small></div>
      <div class="cd-box"><span id="hours">00</span><small>Godz</small></div>
      <div class="cd-box"><span id="minutes">00</span><small>Min</small></div>
      <div class="cd-box"><span id="seconds">00</span><small>Sek</small></div>
    </div>
    <?php endif; ?>

    <div class="hero-actions nc-reveal nc-d6">
      <div class="hero-actions-row">
        <a href="register.php" class="hero-main-btn btn-pulse-epic"><?php echo $season_live ? 'Załóż konto' : 'Dołącz przed startem'; ?></a>
        <a href="/launcher/" class="hero-sub-btn">Pobierz launcher</a>
      </div>
      <p class="cta-subtext">C:\Games\Lineage II · Manifest SHA256 · auto-update</p>
    </div>

  </section>

  <section class="nostalgie-philosophy nc-scroll-reveal" aria-labelledby="philo-heading">
    <h2 class="philo-title" id="philo-heading">Nostalgie™ Philosophy</h2>

    <p>
      Lineage II Nostalgie™ to świat zbudowany dla tych, którzy pamiętają, czym naprawdę było Lineage II.
      Dla graczy, którzy pamiętają czasy, gdy handel miał wagę, crafting budował potęgę klanów,
      a zdobycie upragnionego elementu ekwipunku było wydarzeniem — nie kliknięciem w sklepie.
    </p>

    <p>
      Naszą misją jest przywrócenie tej formy rozgrywki: stabilnej, długoterminowej, opartej na realnej ekonomii
      i współpracy między graczami. Tutaj rynek żyje, bo tworzą go ludzie. W sklepach nie znajdziesz SSD+ ani BSSD+,
      nie kupisz gotowych topowych setów — wszystko powstaje dzięki craftowi, spoilowi, handlowi i zaangażowaniu społeczności.
      Każda Adena ma znaczenie. Każdy materiał ma wartość. Każdy crafted item ma swoją historię.
    </p>

    <p>
      Serwer działa w formule <b>x1</b> (EXP, SP, drop, adena), aby zachować klasyczne tempo.
      Spoil Chance oraz nagrody z questów (XP/SP/Adena) są na <b>x1.3</b>.
      Patron Fundamentu dodaje wyłącznie <b>x1.1 EXP/SP</b> — drop, spoil i questy zostają wspólne.
    </p>

    <div class="philo-highlight">
      Bo questy w Nostalgie™ nie są dodatkiem.<br>
      Są częścią świata.
    </div>

    <p>
      Budują historię postaci, prowadzą przez lokacje, które wielu graczy na innych serwerach po prostu omija.
      Chcemy, aby świat odzyskał swoje barwy — aby progres nie był wyłącznie grindem, lecz drogą.
    </p>

    <p>
      Nostalgie™ to projekt długoterminowy. Zarówno serwer, jak i sama strona internetowa znajdują się na etapie ciągłej rozbudowy.
      Docelowo strona oraz serwer mają tworzyć jeden, spójny ekosystem — połączony świat gry, ekonomii i społeczności.
    </p>

    <p class="philo-signature">
      To miejsce dla graczy, którzy nie szukają chwilowej rozrywki.<br>
      To świat dla tych, którzy chcą zostać na lata.<br>
      Gdzie progres wymaga czasu. Współpraca ma znaczenie.<br>
      <span class="nc-gold-line">A legenda buduje się miesiącami — nie dniami.</span>
    </p>
  </section>

  <section class="community-section nc-community nc-scroll-reveal">
    <h2 class="section-title">Dołącz do społeczności</h2>
    <p class="nc-community-sub">Discord, YouTube i FAQ — wszystko w jednym miejscu.</p>
    <div class="community-buttons">
      <a href="https://discord.gg/nostalgie" class="cta-btn" target="_blank" rel="noopener noreferrer">Discord</a>
      <a href="https://www.youtube.com/@nostalgiel2" class="cta-btn" target="_blank" rel="noopener noreferrer">YouTube</a>
      <a href="faq.php" class="cta-btn">FAQ</a>
    </div>
  </section>

</div>

<?php if (!$season_live): ?>
<script src="/assets/js/countdown.js?v=<?php echo time(); ?>"></script>
<?php endif; ?>

<?php require_once __DIR__ . '/../templates/footer.php'; ?>
