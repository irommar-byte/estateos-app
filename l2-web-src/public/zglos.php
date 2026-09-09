<?php
require_once __DIR__ . '/includes/Lang.php';
require_once __DIR__ . '/../app/config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../app/phpnews/Exception.php';
require __DIR__ . '/../app/phpnews/PHPMailer.php';
require __DIR__ . '/../app/phpnews/SMTP.php';

$status = "";
$status_msg = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['message'])) {
    $user_msg = htmlspecialchars($_POST['message']);
    $sender = isset($_SESSION['login']) ? $_SESSION['login'] : 'Niezalogowany';
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = MAIL_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USER;
        $mail->Password   = MAIL_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = MAIL_PORT;
        $mail->CharSet    = 'UTF-8';
        $mail->setFrom(MAIL_FROM, 'Nostalgie™ Support');
        $mail->addAddress(MAIL_ADMIN);
        $mail->isHTML(true);
        $mail->Subject = "Zgloszenie: $sender";
        $mail->Body    = "<h3>Zgloszenie Nostalgie™</h3><p><strong>Od:</strong> $sender</p><p>$user_msg</p>";
        $mail->send();
        $status = "success";
        $status_msg = "Zgłoszenie wysłane pomyślnie!";
    } catch (Exception $e) {
        $status = "error";
        $status_msg = "Błąd: " . $mail->ErrorInfo;
    }
}
require_once __DIR__ . '/../templates/header.php';
?>


<div class="nostalgie-login-wrapper">
    <div class="nostalgie-card">
        <div class="n-header">
            <h2 class="n-title"><?= __("support_title") ?></h2>
            <div class="n-subtitle"><?= __("support_desc") ?></div>
        </div>

        <?php if($status === "success"): ?>
            <div class="n-msg n-msg-success">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span><?= $status_msg ?></span>
            </div>
        <?php elseif($status === "error"): ?>
            <div class="n-msg n-msg-error">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span><?= $status_msg ?></span>
            </div>
        <?php endif; ?>

        <?php if($status !== "success"): ?>
        <form action="" method="POST">
            <div class="n-group">
                <textarea name="message" class="n-input" placeholder="<?= __("holder_support_msg") ?>" required style="height: 180px; resize: none; padding-top: 15px;"></textarea>
            </div>
            <button type="submit" class="btn gold"><?= __("btn_send_support") ?></button>
        </form>
        <?php else: ?>
            <div style="text-align: center; margin-top: 20px;">
                <a href="index.php" class="btn gold" style="text-decoration: none; display: inline-block; line-height: 45px;">Wróć do Aden</a>
            </div>
        <?php endif; ?>
    </div>
</div>

<?php require_once __DIR__ . '/../templates/footer.php'; ?>
