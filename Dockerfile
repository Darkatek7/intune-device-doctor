# MDM Doctor – statische SPA, ausgeliefert über nginx.
# Gebaut wird auf dem Host (npm run docker:up bzw. npm run build), das Image übernimmt nur dist/.
# So braucht der Image-Build keinen npm-Zugriff (z. B. hinter Firmen-Proxys mit TLS-Inspektion).
# VITE_*-Werte (.env.local) werden beim Host-Build in den Bundle übernommen.
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
