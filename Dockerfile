# MDM Doctor – statische SPA, ausgeliefert über nginx.
# Das Image übernimmt nur das fertige dist/ (Build auf dem Host bzw. im CI-Workflow
# .github/workflows/container.yml). So braucht der Image-Build keinen npm-Zugriff, z. B. hinter
# Firmen-Proxys mit TLS-Inspektion.
# Konfiguration: VITE_*-Umgebungsvariablen beim Start (docker/40-mdm-doctor-config.sh schreibt
# daraus config.js); bei einem eigenen Build zusätzlich die Werte aus .env.local im Bundle.
# nginx ab 1.29.3 nötig (add_header_inherit in docker/nginx.conf); 1.30 ist die stabile Reihe.
FROM nginx:1.30-alpine
LABEL org.opencontainers.image.title="MDM Doctor" \
      org.opencontainers.image.description="Intune Device Troubleshooter (read-only)" \
      org.opencontainers.image.licenses="MIT"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0755 docker/40-mdm-doctor-config.sh /docker-entrypoint.d/40-mdm-doctor-config.sh
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
