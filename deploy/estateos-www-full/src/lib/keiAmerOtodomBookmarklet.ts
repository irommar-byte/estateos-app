import type { KeiOutreachSenderProfile } from '@/lib/keiAmerOutreachMessage';

function escapeForJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

/** Zakładka przeciągana do paska — wypełnia formularz kontaktu na OtoDom/OLX (wiadomość ze schowka). */
export function buildOtodomContactBookmarklet(sender: KeiOutreachSenderProfile): string {
  const name = escapeForJsString(sender.name.trim());
  const email = escapeForJsString(sender.email.trim());
  const phone = escapeForJsString(sender.phone.trim());

  const script = `(function(){var n='${name}',e='${email}',p='${phone}';function set(el,v){if(!el)return;var proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;var s=Object.getOwnPropertyDescriptor(proto,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}function findInput(keys){var nodes=document.querySelectorAll('input,textarea');for(var i=0;i<nodes.length;i++){var el=nodes[i];var ph=(el.placeholder||'').toLowerCase();var nm=(el.name||'').toLowerCase();var id=(el.id||'').toLowerCase();for(var j=0;j<keys.length;j++){var k=keys[j];if(ph.indexOf(k)>=0||nm.indexOf(k)>=0||id.indexOf(k)>=0)return el;}var lbl=el.closest('label');if(lbl){var t=lbl.textContent.toLowerCase();for(var x=0;x<keys.length;x++){if(t.indexOf(keys[x])>=0)return el;}}}return null;}function fill(msg){set(findInput(['imię','imie','name']),n);set(findInput(['email','e-mail','mail']),e);set(findInput(['telefon','phone','numer']),p);var ta=findInput(['wiadomość','wiadomosc','message'])||document.querySelector('textarea');set(ta,msg||'');alert('EstateOS: pola wypełnione. Sprawdź treść i kliknij Wyślij na portalu.');}if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(fill).catch(function(){fill(prompt('Wklej wiadomość zaproszenia:','')||'');});}else{fill(prompt('Wklej wiadomość zaproszenia:','')||'');}})();`;

  return `javascript:${encodeURIComponent(script)}`;
}
