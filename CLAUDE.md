# EstateOS — zasady dla agentów

Przed pierwszą zmianą, commitem lub deployem przeczytaj `deploy/AGENT_GIT_DEPLOY_PLAYBOOK.md`.

- Aplikacja EstateOS (iOS): pracuj w `/Users/marian/eos-mobile-canonical` (gałąź `mobile-canonical-20260514`). Xcode buduje wyłącznie z `ios/EstateOS.xcworkspace` w tym katalogu.
- `/Users/marian/apple-style-app` (gałąź `tvos-redesign`) nie jest źródłem buildu EstateOS.
- Backend estateos.pl: `/Users/marian/estateos-recovery-deploy` (gałąź `recovery-local-snapshot`), deploy na VPS przez `ssh estateos`.
- Zmiany w aplikacji zgłaszaj jako gotowe dopiero wtedy, gdy są zacommitowane w `eos-mobile-canonical`.
