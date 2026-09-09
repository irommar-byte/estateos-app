<?php
require_once __DIR__ . "/includes/Lang.php";
require_once __DIR__ . '/../app/config.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
if (!isset($_SESSION['login'])) { header('Location: /login.php'); exit; }

$user = $_SESSION['login'];
$msg = "";

require_once __DIR__ . "/includes/Store.php";
$store = new Store($conn);

// --- KONFIGURACJA ---
$cost = 30;
$duration_days = 30;

$current_balance = $store->getBalance($user);

if (isset($_POST['become_patron'])) {
    if ($current_balance >= $cost) {
        $conn->begin_transaction();
        try {
            if (!$store->charge($user, $cost)) {
                throw new Exception("charge");
            }
            if (!$store->givePremium($user, $duration_days)) {
                throw new Exception("premium");
            }
            $store->logAction($user, -$cost, "Patron Fundamentu 30 dni");
            $conn->commit();
            $msg = "<div class='n-alert success'>✧ Równowaga została zachowana. Dziękujemy, Patronie. ✧</div>";
            $current_balance -= $cost;
        } catch (Exception $e) {
            $conn->rollback();
            $msg = "<div class='n-alert error'>Błąd systemu. Transakcja anulowana.</div>";
        }
    } else {
        $msg = "<div class='n-alert error'>Brakuje energii (Coins).</div>";
    }
}

// --- LOGIKA PASKA POSTĘPU (KOLORY) ---
$goal = 1400;
$result = $conn->query("SELECT IFNULL(SUM(coins),0) AS total FROM web_donate_logs WHERE coins > 0 AND MONTH(created_at)=MONTH(CURRENT_DATE()) AND YEAR(created_at)=YEAR(CURRENT_DATE())");
$total = ($result && $row = $result->fetch_assoc()) ? (int)$row["total"] : 0;
$percent = $goal > 0 ? min(100, round(($total / $goal) * 100)) : 0;

// Obliczanie koloru paska (Od czerwonego do zielonego)
if ($percent <= 50) { $r = 255; $g = round(255 * ($percent / 50)); } 
else { $r = round(255 * (1 - (($percent - 50) / 50))); $g = 255; }
$b = 0;
$barColor = "rgb($r,$g,$b)";

require_once __DIR__ . '/../templates/header.php';
?>

<style>
    /* STYLES */
    .shop-container { max-width: 920px; margin: 40px auto; padding: 20px; text-align: center; box-sizing: border-box; }
    
    .lore-card {
        background: rgba(10, 10, 12, 0.85);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 215, 0, 0.1);
        border-radius: 30px;
        padding: 50px 30px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        position: relative;
        overflow: visible;
        isolation: isolate;
    }
    .lore-card::before {
        content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px;
        background: linear-gradient(90deg, transparent, #ffd700, transparent);
    }

    .lore-text {
        font-family: 'Georgia', serif; font-size: 1.05rem; line-height: 1.8; color: #ccc;
        margin: 30px auto; max-width: 680px; text-align: justify;
        background: rgba(255,255,255,0.03); padding: 25px; border-radius: 10px; border-left: 2px solid #b1922e;
    }
    .lore-text b { color: #ffd700; font-weight: normal; text-shadow: 0 0 10px rgba(255,215,0,0.2); }
    .lore-paragraph { margin-bottom: 15px; display: block; }

    /* RYTUAŁ I CHECKBOX */
    .ritual-area { margin-top: 40px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); }
    
    .checkbox-wrapper {
        display: flex; align-items: center; justify-content: center; gap: 15px;
        cursor: pointer; user-select: none; margin-bottom: 25px;
        background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 50px; width: fit-content; margin-left: auto; margin-right: auto;
        border: 1px solid rgba(255,255,255,0.1); transition: 0.3s;
    }
    .checkbox-wrapper:hover { border-color: #ffd700; }
    
    .magic-checkbox {
        appearance: none; width: 20px; height: 20px; border: 2px solid #666; border-radius: 4px;
        transition: 0.3s; display: grid; place-content: center;
    }
    .magic-checkbox::before { content: ""; width: 10px; height: 10px; transform: scale(0); transition: 0.2s; background: #ffd700; box-shadow: 0 0 10px #ffd700; }
    .magic-checkbox:checked { border-color: #ffd700; }
    .magic-checkbox:checked::before { transform: scale(1); }

    /* PRZYCISK Z ZIELONYM HOVEREM */
    .btn-ritual {
        background: #222; color: #555; border: 1px solid #333;
        padding: 15px 50px; border-radius: 50px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;
        transition: all 0.3s ease-in-out; cursor: not-allowed; pointer-events: none; filter: grayscale(100%); opacity: 0.5;
        font-size: 1.1rem;
    }
    
    /* STAN AKTYWNY (PO ZAZNACZENIU) */
    .btn-ritual.active {
        filter: grayscale(0%); opacity: 1; cursor: pointer; pointer-events: auto;
        border-color: #555; color: #ccc;
    }
    
    /* EFEKT HOVER - NEON GREEN */
    .btn-ritual.active:hover {
        background: #39ff14 !important;
        color: #000 !important;
        box-shadow: 0 0 25px #39ff14, 0 0 50px #39ff14;
        border-color: #39ff14;
        transform: scale(1.05);
    }

    /* PASEK POSTĘPU */
    .support-bar-wrap { width: 100%; max-width: 600px; height: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; margin: 10px auto; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
    .support-bar-fill { height: 100%; transition: width 1s ease-out; box-shadow: 0 0 15px currentColor; }
    
    .shop-inline-link {
        color: #ffd700;
        text-decoration: underline;
        text-underline-offset: 3px;
        pointer-events: auto;
        position: relative;
        z-index: 6;
    }

    .shop-actions {
        position: relative;
        z-index: 20;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin: 22px auto 8px;
        padding: 0 4px;
        isolation: isolate;
    }
    .shop-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        min-width: min(100%, 240px);
        padding: 12px 22px;
        border-radius: 999px;
        border: 1px solid rgba(201, 162, 39, 0.45);
        color: #efe6d4;
        text-decoration: none !important;
        background: rgba(0, 0, 0, 0.4);
        pointer-events: auto !important;
        cursor: pointer;
        touch-action: manipulation;
        box-sizing: border-box;
        position: relative;
        z-index: 21;
    }
    .shop-action--gold {
        color: #f3d98a;
        border-color: rgba(243, 217, 138, 0.6);
    }
    .n-alert { padding: 15px; margin-bottom: 20px; border-radius: 10px; font-weight: bold; }
    .n-alert.success { background: rgba(0,255,0,0.1); color: #4f4; border: 1px solid #4f4; }
    .n-alert.error { background: rgba(255,0,0,0.1); color: #f44; border: 1px solid #f44; }

</style>

<div class="shop-container">
    <div class="lore-card">
        
        <?php echo $msg; ?>

        <header class="shop-hero">
            <h1 class="shop-hero__title">FUNDAMENT</h1>
            <p class="shop-hero__sub">Centrum Stabilności Świata</p>
        </header>

        <div class="lore-text">
            <span class="lore-paragraph">To nie jest sklep. To przestrzeń, w której utrzymujemy równowagę. Środki przekazywane tutaj wspierają fizyczną infrastrukturę serwera, łącze oraz systemy ochronne. To one pozwalają temu światu pozostać stabilnym, bezpiecznym i długowiecznym.</span>
            
            <span class="lore-paragraph">Równowaga jest nienaruszalna. Wsparcie Fundamentu nie daje przewagi bojowej ani mechanik, które mogłyby zachwiać strukturą świata. Siłę zdobywa się w grze. Zasady pozostają wspólne dla wszystkich.</span>

            <span class="lore-paragraph">W ramach uznania świat przyznaje Patronom delikatne wzmocnienie tempa rozwoju — ruch z <b>x1</b> do <b>x1.1</b> (EXP/SP). To subtelne przyspieszenie komfortu, nie przewaga w walce. Drop zostaje x1. Spoil i nagrody z questów są <b>x1.3</b> dla wszystkich.</span>
            <span class="lore-paragraph">Każde kolejne podtrzymanie Fundamentu nie zastępuje poprzedniego — wzmacnia je. Czas Patronatu sumuje się, tworząc ciągłość wsparcia i stabilności.</span>
            <span class="lore-paragraph">Coin of Luck wymieniasz u <b>Aurelii</b> obok Clarissy (teleport w Giran): zwoje podróży, Blessed Enchant Weapon/Armor, Feather of Blessing, wierzchowce, czapki i agathiony kosmetyczne. Bez butelek CP/MP i vitality. Zwykłe zwoje enchant spadają ze świata. <a href="/transfer.php" class="shop-inline-link">Prześlij Coin of Luck do gry</a>, zrób relog, potem Aurelia albo Dimensional Merchant — „Odbierz przedmiot wymiarowy”.</span>

            <span class="lore-paragraph">W zamian za przekazanie <b>30 Coins</b> otrzymasz status <b>Patron Fundamentu</b> na 30 dni. Nie jest to tytuł wyższości, lecz znak odpowiedzialności.</span>
        </div>

        <div class="shop-rates">
            <?php require __DIR__ . '/../templates/rates_board.php'; ?>
        </div>

        <div style="margin-top: 40px; margin-bottom: 10px; font-size: 1rem; color: #aaa;">
            STABILNOŚĆ ŚWIATA: <b style="color:<?= $barColor ?>"><?= $percent ?>%</b>
        </div>
        
        <div class="support-bar-wrap">
            <div class="support-bar-fill" style="width: <?= $percent ?>%; background: <?= $barColor ?>; color: <?= $barColor ?>;"></div>
        </div>

        <div class="ritual-area">
            <form method="POST">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="magic-checkbox" id="ritualCheck" onchange="toggleRitual()">
                    <span style="color: #ccc; font-size: 0.9rem;">Akceptuję zasady równowagi</span>
                </label>
                
                <button type="submit" name="become_patron" id="ritualBtn" class="btn-ritual">
                    Wzmacniam Fundament
                </button>
            </form>
        </div>

    </div>

    <nav class="shop-actions" aria-label="Portfel">
        <a class="shop-action shop-action--gold" href="/donate.php">Doładuj Coins</a>
        <a class="shop-action" href="/transfer.php">Prześlij Coin of Luck do gry</a>
    </nav>
</div>

<script>
function toggleRitual() {
    const cb = document.getElementById('ritualCheck');
    const btn = document.getElementById('ritualBtn');
    if(cb.checked) {
        btn.classList.add('active');
        btn.innerHTML = "✦ Przekazuję Energię (30 Coins)";
    } else {
        btn.classList.remove('active');
        btn.innerHTML = "Wzmacniam Fundament";
    }
}
</script>

<?php require_once __DIR__ . '/../templates/footer.php'; ?>
