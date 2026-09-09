# EstateOS edge VM

Docelowa VM: Debian, `1 vCPU`, `768 MB RAM`, stały adres LAN. QTS/hypervisor musi
zachować co najmniej około `2,25 GB RAM`; VM EstateOS i Lineage po `4,5 GB`.

Kolejność bezpiecznego przełączenia:

1. Zainstaluj Nginx i Certbot, skopiuj `estateos-edge-nginx.conf`.
2. Przed aktywacją TLS pozyskaj oba certyfikaty przez HTTP-01.
3. Sprawdź z edge: `192.168.50.128:80`, `192.168.50.200:80`,
   `192.168.50.200:4321` i `192.168.50.200:4322`.
4. W routerze przekieruj publiczne `80/443` wyłącznie na edge.
5. Wykonaj smoke obu domen i zachowaj poprzedni NAT jako rollback.
6. Dopiero po obserwacji ogranicz `80/443` VM aplikacyjnych do adresu edge
   i sieci administracyjnej.

Konfiguracja celowo nie zawiera kluczy ani certyfikatów.
