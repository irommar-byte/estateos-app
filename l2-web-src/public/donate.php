<?php
require_once __DIR__ . "/includes/Lang.php";
require_once __DIR__ . "/includes/hotpay_config.php";
require_once __DIR__ . "/includes/Store.php";
require_once __DIR__ . "/../app/config.php";

if (session_status() === PHP_SESSION_NONE) { session_start(); }
$user = isset($_SESSION['login']) ? $_SESSION['login'] : null;
if (!$user) { header("Location: /login.php"); exit; }

$store = new Store($conn);
$current_balance = $store->getBalance($user);

$player_email = "player@nostalgie.pl";
$em = $conn->prepare("SELECT email FROM accounts WHERE login = ? LIMIT 1");
if ($em) {
    $em->bind_param("s", $user);
    $em->execute();
    $er = $em->get_result()->fetch_assoc();
    if ($er && !empty($er["email"]) && filter_var($er["email"], FILTER_VALIDATE_EMAIL)) {
        $player_email = $er["email"];
    }
}

$kwota = isset($_GET['kwota']) ? floatval($_GET['kwota']) : 0;

if ($kwota > 0) {
    $id_zamowienia = $user . "__" . uniqid();
    $kwota_format = number_format($kwota, 2, '.', '');
    $hash = hash('sha256', HP_HASLO . ";" . $kwota_format . ";" . HP_NAZWA_USLUGI . ";" . HP_ADRES_WWW . ";" . $id_zamowienia . ";" . HP_SEKRET);

    $params = [
        'SEKRET' => HP_SEKRET,
        'KWOTA' => $kwota_format,
        'NAZWA_USLUGI' => HP_NAZWA_USLUGI,
        'ADRES_WWW' => HP_ADRES_WWW,
        'ID_ZAMOWIENIA' => $id_zamowienia,
        'EMAIL' => $player_email,
        'TYP' => 'INIT',
        'HASH' => $hash,
        'CONTROL' => $user
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://platnosc.hotpay.pl/");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $json = json_decode($response, true);
    
    if (isset($json['STATUS']) && $json['STATUS'] === true) {
        header("Location: " . $json['URL']);
        exit;
    } else {
        echo "<div class='n-alert n-error'>Błąd HotPay: " . htmlspecialchars(print_r($response, true)) . "</div>";
        exit;
    }
}
include("../templates/header.php");
?>

<style>
    /* Styling Specific for Donate Page matching Nostalgie Modern Glass */
    .donate-wrapper { position: relative; z-index: 3; 
        max-width: 1100px;
        margin: 40px auto;
        padding: 0 20px;
    }
    
    .wallet-status-bar {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 15px;
        padding: 25px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    
    .wallet-info .label { color: #888; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
    .wallet-info .value { color: #ffd700; font-size: 2.2rem; font-weight: 800; text-shadow: 0 0 15px rgba(255, 215, 0, 0.3); font-family: 'Cinzel', serif; }
    
    .btn-spend {
        background: linear-gradient(135deg, #333 0%, #1a1a1a 100%);
        border: 1px solid #555;
        color: #fff;
        padding: 12px 30px;
        border-radius: 50px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .btn-spend:hover {
        border-color: #ffd700;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        color: #ffd700;
    }

    .packages-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 25px;
        margin-top: 20px;
    }

    .pack-card {
        background: linear-gradient(160deg, rgba(30,30,30,0.8) 0%, rgba(10,10,10,0.9) 100%);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 16px;
        padding: 30px 20px;
        text-align: center;
        text-decoration: none;
        position: relative;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 280px;
    }

    .pack-card:hover {
        transform: translateY(-10px) scale(1.02);
        border-color: #b1922e;
        box-shadow: 0 15px 40px rgba(0,0,0,0.6);
    }

    /* Card Tier Styles */
    .pack-card.tier-1 { border-top: 3px solid #666; }
    .pack-card.tier-2 { border-top: 3px solid #silver; }
    .pack-card.tier-3 { border-top: 3px solid #ffd700; background: linear-gradient(160deg, rgba(40,30,10,0.85) 0%, rgba(10,10,10,0.95) 100%); }
    .pack-card.tier-4 { border-top: 3px solid #00e5ff; border-bottom: 1px solid #00e5ff; }

    .pack-badge {
        position: absolute;
        top: 15px;
        right: -30px;
        background: #b1922e;
        color: #000;
        font-weight: bold;
        padding: 5px 30px;
        transform: rotate(45deg);
        font-size: 0.8rem;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        z-index: 2;
    }
    .badge-best { background: linear-gradient(45deg, #ffd700, #ffaa00); }
    .badge-whale { background: linear-gradient(45deg, #00e5ff, #0099cc); color: #fff; }

    .pack-coins-amount {
        font-size: 2.5rem;
        font-weight: 800;
        color: #fff;
        margin: 20px 0 5px 0;
        display: block;
        font-family: 'Cinzel', serif;
    }
    
    .pack-bonus {
        color: #4caf50;
        font-size: 0.9rem;
        font-weight: bold;
        background: rgba(76, 175, 80, 0.1);
        padding: 4px 10px;
        border-radius: 10px;
        display: inline-block;
        margin-bottom: 20px;
    }

    .pack-price-tag {
        font-size: 1.4rem;
        color: #ddd;
        border-top: 1px solid rgba(255,255,255,0.1);
        padding-top: 15px;
        margin-top: auto;
    }
    
    .pack-btn {
        margin-top: 15px;
        background: transparent;
        border: 1px solid #444;
        color: #aaa;
        padding: 8px;
        border-radius: 4px;
        font-size: 0.9rem;
        transition: 0.3s;
    }
    
    .pack-card:hover .pack-btn {
        background: #b1922e;
        color: #000;
        border-color: #b1922e;
    }
    
    .tier-3 .pack-coins-amount { color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.4); }
    .tier-4 .pack-coins-amount { color: #00e5ff; text-shadow: 0 0 10px rgba(0, 229, 255, 0.4); }

</style>

<div class="donate-wrapper">
    
    <div class="n-title" style="text-align:center; margin-bottom:10px;">Nostalgie™ Lifeblood</div>
    <div class="n-subtitle" style="text-align:center; margin-bottom:40px;">1 PLN = 1 NC Coin. Pakiety: 30→30, 50→55, 100→120, 200→250. 1 NC = 1 Coin of Luck.</div>

    <div class="wallet-status-bar">
        <div class="wallet-info">
            <div class="label">Aktualne Saldo</div>
            <div class="value"><?= number_format($current_balance, 0) ?> NC</div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <a href="/shop.php" class="btn-spend">
                <span>Otwórz Skarbiec</span>
            </a>
            <a href="/transfer.php" class="btn-spend">
                <span>Coin of Luck do gry</span>
            </a>
        </div>
    </div>

    <div class="packages-grid">
        <a href="?kwota=30" class="pack-card tier-1">
            <div style="font-size:0.9rem; color:#888;">PAKIET STARTOWY</div>
            <div>
                <span class="pack-coins-amount">30</span>
                <span style="color:#aaa; font-size:0.9rem;">Coins</span>
            </div>
            <div style="height:25px;"></div> <div class="pack-price-tag">30 PLN</div>
            <div class="pack-btn">Wybierz</div>
        </a>

        <a href="?kwota=50" class="pack-card tier-2">
            <div style="font-size:0.9rem; color:#silver;">PAKIET SREBRNY</div>
            <div>
                <span class="pack-coins-amount">55</span>
                <span style="color:#aaa; font-size:0.9rem;">Coins</span>
            </div>
            <div class="pack-bonus">+5 GRATIS (+10%)</div>
            <div class="pack-price-tag">50 PLN</div>
            <div class="pack-btn">Wybierz</div>
        </a>

        <a href="?kwota=100" class="pack-card tier-3">
            <div class="pack-badge badge-best">POPULAR</div>
            <div style="font-size:0.9rem; color:#ffd700;">PAKIET ZŁOTY</div>
            <div>
                <span class="pack-coins-amount">120</span>
                <span style="color:#ffd700; font-size:0.9rem;">Coins</span>
            </div>
            <div class="pack-bonus" style="color:#ffd700; background:rgba(255, 215, 0, 0.15);">+20 GRATIS (+20%)</div>
            <div class="pack-price-tag" style="color:#fff;">100 PLN</div>
            <div class="pack-btn">Wybierz</div>
        </a>

        <a href="?kwota=200" class="pack-card tier-4">
            <div class="pack-badge badge-whale">BEST VALUE</div>
            <div style="font-size:0.9rem; color:#00e5ff;">PAKIET LEGENDARNY</div>
            <div>
                <span class="pack-coins-amount">250</span>
                <span style="color:#00e5ff; font-size:0.9rem;">Coins</span>
            </div>
            <div class="pack-bonus" style="color:#00e5ff; background:rgba(0, 229, 255, 0.15);">+50 GRATIS (+25%)</div>
            <div class="pack-price-tag" style="color:#fff;">200 PLN</div>
            <div class="pack-btn">Wybierz</div>
        </a>
    </div>
    
    <div style="text-align:center; margin-top:30px; font-size:0.8rem; color:#555;">
        Dokonując wpłaty, akceptujesz <a href="/terms.php" style="color:#777;">Regulamin Serwisu</a>. Płatności obsługuje HotPay.
    </div>
</div>

<?php include("../templates/footer.php"); ?>
