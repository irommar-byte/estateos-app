<?php
require_once __DIR__ . '/../templates/header.php';
?>
<style>
.faq-wrapper { max-width: 920px; margin: 40px auto 80px; padding: 0 22px; }
.faq-hero { text-align: center; margin-bottom: 48px; }
.faq-hero h1 { color: #d4af37; font-family: Cinzel, serif; letter-spacing: .12em; margin-bottom: 12px; }
.faq-hero p { color: #888; line-height: 1.7; }
.faq-block { margin-bottom: 22px; padding: 26px 28px; background: rgba(15,18,25,.75); border: 1px solid rgba(212,175,55,.15); border-radius: 12px; }
.faq-block h3 { color: #fff; margin: 0 0 10px; font-size: 1.05rem; }
.faq-block p { color: #a5a5a5; font-size: .95rem; line-height: 1.8; margin: 0; }
</style>
<div class="faq-wrapper">
    <div class="faq-hero">
        <h1>O ŚWIECIE</h1>
        <p>To, co jest napisane na stronie, ma odpowiadać serwerowi. Poniżej stoi to, co naprawdę działa.</p>
    </div>

    <div class="faq-block" style="padding:0;background:transparent;border:0">
        <?php require __DIR__ . '/../templates/rates_board.php'; ?>
    </div>

    <div class="faq-block">
        <h3>Wsparcie i Coin of Luck</h3>
        <p>
            1 PLN = 1 NC Coin. Pakiety: 30 zł → 30 NC, 50 → 55, 100 → 120, 200 → 250.
            1 NC = 1 Coin of Luck. Patron to 30 NC na 30 dni (czas się sumuje).
            Coin of Luck jest zbywalny. Sklep Aurelii stoi obok Clarissy przy teleporcie w Giran:
            podróż, Blessed Enchant Weapon/Armor, Feather of Blessing, wierzchowce, wygląd, agathiony kosmetyczne.
            Bez butelek CP/MP i vitality. Zwykłe zwoje enchant spadają ze świata.
            Odbiór: relog, potem Aurelia albo Dimensional Merchant → „Odbierz przedmiot wymiarowy”.
        </p>
    </div>

    <div class="faq-block">
        <h3>Buffer początkowy (Newbie Guide / Adventurers' Guide)</h3>
        <p>
            Nie ma pełnego Buffer NPC ani płatnego scheme buffera. Magię wsparcia daje Guide w miastach startowych
            (i Adventurers' Guide) w modelu <b>taper</b> — im wyższy level, tym mniej buffów, aż wreszcie zero.
            Od <b>6</b> poziomu dostajesz 1 buff, potem co level +1, aż do <b>pełnych 8</b> na poziomach <b>13–20</b>.
            Od <b>21</b> co level znika 1 buff (od końca listy). Od <b>28</b> Guide już nie buffuje.
            Wojownik: Wind Walk → Shield → Magic Barrier → Bless the Body → Vampiric Rage → Regeneration → Haste → Life Cubic.
            Mag: Wind Walk → Shield → Magic Barrier → Bless the Soul → Acumen → Concentration → Empower → Life Cubic.
            Servitor ma osobną listę u tego samego NPC, z tymi samymi limitami poziomu mistrza.
            Blessing of Protection zostaje jak na High Five: poniżej 39 i przed drugą profesją.
            Potem liczy się party, song/dance i własne skille.
        </p>
    </div>

    <div class="faq-block">
        <h3>Shoty</h3>
        <p>
            U grocera kupisz tylko shoty <b>No Grade</b> (Spiritshot / Blessed Spiritshot i paczki NG).
            Soulshot oraz wszystkie shoty od <b>D wzwyż</b> (w tym Blessed Spiritshot D–S) <b>nie stoją w sklepach</b> —
            tylko craft z rudy (Soul Ore / Spirit Ore) albo handel między graczami.
        </p>
    </div>

    <div class="faq-block">
        <h3>Czego nie ma</h3>
        <p>
            Brak pełnego Buffer NPC i scheme buffera, brak GM shop z top gearem dla graczy, brak profesji za adenę,
            brak darmowego teleportu między miastami. Teleport u Gatekeepera jest płatny.
            Offline trade jest włączony dla wszystkich (pokój, komenda .offline).
        </p>
    </div>

    <div class="faq-block">
        <h3>Dlaczego High Five x1?</h3>
        <p>
            Progres ma smak, gdy wymaga czasu. Spoil i questy są lekko podbite, żeby craft i ekonomia żyły,
            a nie żeby wyścig poziomów zastąpił świat.
        </p>
    </div>

    <div class="faq-block">
        <h3>Panel gracza</h3>
        <p>
            Po zalogowaniu: wszystkie postacie, HP/MP/CP, vitality, PvP/PK, klan, klasy, ekwipunek,
            Olympiad, przyjaciele, Adena, oczekujące Coin of Luck i przywrócenie HP/MP/CP
            dla postaci wylogowanej. Brak darmowego teleportu do miasta z panelu.
        </p>
    </div>
</div>
<?php require_once __DIR__ . '/../templates/footer.php'; ?>
