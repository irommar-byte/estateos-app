<?php
require_once __DIR__ . '/../app/config.php';
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (!isset($_SESSION['login'])) {
    header('Location: /login.php');
    exit;
}

require_once __DIR__ . '/includes/Lang.php';
require_once __DIR__ . '/includes/Store.php';

$user = (string) $_SESSION['login'];
$msg = '';
$store = new Store($conn);
$balance = $store->getBalance($user);

$stmt = $conn->prepare('SELECT char_name, charId, online FROM characters WHERE account_name = ? ORDER BY char_name');
$stmt->bind_param('s', $user);
$stmt->execute();
$chars = $stmt->get_result();
$charRows = [];
if ($chars) {
    while ($row = $chars->fetch_assoc()) {
        $charRows[] = $row;
    }
}

if (isset($_POST['transfer'])) {
    $char_id = (int) ($_POST['char_id'] ?? 0);
    $amount = (int) ($_POST['amount'] ?? 0);

    if ($amount < 1) {
        $msg = 'Wartość musi wynosić minimum 1 Coin of Luck.';
    } elseif ($amount > $balance) {
        $msg = 'Nie masz tyle Coins (saldo: ' . (int) $balance . ').';
    } elseif (!$store->characterBelongsTo($char_id, $user)) {
        $msg = 'Nieprawidłowa postać.';
    } else {
        $conn->begin_transaction();
        try {
            if (!$store->charge($user, $amount)) {
                throw new Exception('charge');
            }
            if (!$store->sendCoL($char_id, $amount)) {
                throw new Exception('send');
            }
            $store->logAction($user, -$amount, 'Transfer CoL do gry (CharID: ' . $char_id . ')');
            $conn->commit();
            header('Location: /transfer.php?success=1');
            exit;
        } catch (Exception $e) {
            $conn->rollback();
            $msg = 'Błąd bazy. Transakcja anulowana.';
        }
    }
    $balance = $store->getBalance($user);
}

require_once __DIR__ . '/../templates/header.php';
?>
<style>
.col-box { max-width: 640px; margin: 28px auto 64px; padding: 0 16px; position: relative; z-index: 3; }
.col-card {
  position: relative;
  z-index: 3;
  background: rgba(12,10,16,.88);
  border: 1px solid rgba(201,162,39,.28);
  border-radius: 22px;
  padding: 28px 22px;
}
.col-card h1 {
  margin: 0 0 8px;
  font-family: Cinzel, Georgia, serif;
  color: #f3d98a;
  font-size: 1.45rem;
  letter-spacing: .06em;
}
.col-card p { color: #cfc3ae; line-height: 1.55; }
.col-bal {
  margin: 18px 0;
  padding: 12px;
  text-align: center;
  border-radius: 12px;
  background: #111;
  color: #9a8f7c;
}
.col-bal b { color: #66ff66; font-size: 1.2em; }
.col-card label { display: block; margin-top: 8px; color: #d8c9a4; }
.col-card select, .col-card input[type=number] {
  width: 100%; padding: 12px; margin: 8px 0 16px;
  background: #1a1a22; color: #fff; border: 1px solid #555; border-radius: 10px;
  box-sizing: border-box;
}
.col-btn {
  width: 100%; min-height: 48px; border: 0; border-radius: 999px;
  font-weight: 700; cursor: pointer;
}
.col-btn:enabled { background: #ffd700; color: #000; }
.col-btn:disabled { background: #444; color: #888; cursor: not-allowed; }
.col-ok { color: #8f8; background: rgba(0,255,0,.1); padding: 12px; border-radius: 10px; }
.col-err { color: #f88; background: rgba(255,0,0,.1); padding: 12px; border-radius: 10px; }
.col-nav { margin-top: 18px; text-align: center; }
.col-nav a { color: #f3d98a; }
</style>
<div class="col-box">
  <div class="col-card">
    <h1>Prześlij Coin of Luck do gry</h1>
    <p>
      1 NC Coin = 1 Coin of Luck. Po wysyłce zrób <b>relog</b> i odbierz paczkę u <b>Aurelii</b>
      (obok Clarissy w Giran) albo u Dimensional Merchant — „Odbierz przedmiot wymiarowy”.
    </p>
    <div class="col-bal">Dostępne Coins: <b><?= (int) $balance ?></b></div>

    <?php if ($msg !== ''): ?>
      <p class="col-err"><?= htmlspecialchars($msg) ?></p>
    <?php endif; ?>
    <?php if (isset($_GET['success'])): ?>
      <p class="col-ok">Wysłano. Relog postaci i odbierz Coin of Luck w oknie Dimensional Item.</p>
    <?php endif; ?>

    <form method="post" action="/transfer.php">
      <label for="char_id">Wybierz postać</label>
      <select id="char_id" name="char_id" required <?= $charRows ? '' : 'disabled' ?>>
        <?php if (!$charRows): ?>
          <option value="">Brak postaci na koncie</option>
        <?php else: ?>
          <?php foreach ($charRows as $c): ?>
            <option value="<?= (int) $c['charId'] ?>">
              <?= htmlspecialchars($c['char_name']) ?>
              (<?= ((int) $c['online'] === 1) ? 'w grze — relog po wysyłce' : 'offline' ?>)
            </option>
          <?php endforeach; ?>
        <?php endif; ?>
      </select>

      <label for="amount">Ilość Coin of Luck</label>
      <input id="amount" type="number" name="amount" min="1" max="<?= max(1, (int) $balance) ?>" value="1" required>

      <button class="col-btn" type="submit" name="transfer" value="1" <?= ($balance < 1 || !$charRows) ? 'disabled' : '' ?>>
        <?= ($balance < 1 ? 'Brak środków — doładuj Coins' : (!$charRows ? 'Brak postaci' : 'Wyślij do gry')) ?>
      </button>
    </form>

    <div class="col-nav">
      <a href="/donate.php">Doładuj Coins</a>
      ·
      <a href="/shop.php">Patron Fundamentu</a>
      ·
      <a href="/panel.php">Panel</a>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../templates/footer.php'; ?>
