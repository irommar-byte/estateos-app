import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

export async function GET() {
  try {
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    // Domyślnie bezpiecznie zakładamy, że weryfikacja JEST WŁĄCZONA, chyba że wpisano false
    const isSmsEnabled = !envContent.includes('ENABLE_SMS_VERIFICATION=false');
    return NextResponse.json({ smsEnabled: isSmsEnabled });
  } catch(e) { return NextResponse.json({ error: 'Odczyt ustawień niemożliwy' }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const { enable } = await req.json();
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    // Zmiana lub dodanie zmiennej w pliku
    if (envContent.includes('ENABLE_SMS_VERIFICATION=')) {
        envContent = envContent.replace(/ENABLE_SMS_VERIFICATION=(true|false)/, `ENABLE_SMS_VERIFICATION=${enable}`);
    } else {
        envContent += `\nENABLE_SMS_VERIFICATION=${enable}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Uwaga: PM2 update-env wymaga zewnętrznego przeładowania, ale proces node zaktualizuje swoją pamięć dla kolejnych requestów.
    return NextResponse.json({ success: true, status: enable });
  } catch(e) { return NextResponse.json({ error: 'Zapis ustawień niemożliwy' }, { status: 500 }); }
}
