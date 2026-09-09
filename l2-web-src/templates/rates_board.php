<?php
/** World vs Patron rates — must match live Rates.ini + PremiumSystem.ini */
$rates_world = [
    'EXP' => 'x1',
    'SP' => 'x1',
    'Drop / Adena' => 'x1',
    'Spoil (szansa)' => 'x1.3',
    'Quest XP/SP/Adena' => 'x1.3',
];
$rates_patron = [
    'EXP' => 'x1.1',
    'SP' => 'x1.1',
    'Drop / Adena' => 'x1',
    'Spoil (szansa)' => 'x1.3',
    'Quest XP/SP/Adena' => 'x1.3',
];
?>
<section class="rates-board" aria-label="Stawki świata i Patrona">
  <header class="rates-board__head">
    <p class="rates-board__kicker">High Five · bez pay-to-win</p>
    <h2>Stawki serwera</h2>
    <p>Świat: EXP/SP/drop x1. Spoil i questy x1.3 dla wszystkich. Patron przyspiesza wyłącznie EXP/SP do x1.1.</p>
  </header>
  <div class="rates-board__grid">
    <article class="rates-col">
      <h3>Świat</h3>
      <ul>
        <?php foreach ($rates_world as $k => $v): ?>
          <li><span><?= htmlspecialchars($k) ?></span><b><?= htmlspecialchars($v) ?></b></li>
        <?php endforeach; ?>
      </ul>
    </article>
    <article class="rates-col rates-col--patron">
      <h3>Patron Fundamentu</h3>
      <ul>
        <?php foreach ($rates_patron as $k => $v): ?>
          <li><span><?= htmlspecialchars($k) ?></span><b><?= htmlspecialchars($v) ?></b></li>
        <?php endforeach; ?>
      </ul>
    </article>
  </div>
  <p class="rates-board__note">Vitality jak na High Five (do x3 na 4. stopniu). Patron: 30 NC / 30 dni, czas się sumuje. W grze: <code>.rates</code></p>
</section>
