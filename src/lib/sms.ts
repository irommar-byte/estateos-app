export async function sendSMS(phone: string, message: string) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 9) cleanPhone = `48${cleanPhone}`;

  const params = new URLSearchParams();
  params.append('key', '3a28df0a-8038-44d7-ac7b-e2d8b03fd698');
  params.append('password', 'EstateOS123!');
  params.append('to', cleanPhone);
  params.append('msg', message);
  params.append('from', 'EstateOS');

  const res = await fetch('https://api2.smsplanet.pl/sms', {
    method: 'POST',
    body: params
  });

  const text = await res.text();
  console.log("📩 SMSPLANET:", text);

  return text;
}
