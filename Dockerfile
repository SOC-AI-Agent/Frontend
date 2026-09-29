FROM node:20-alpine AS builder
WORKDIR /app
# npm reaches the registry through the office proxy, as production does.
# Where that proxy isn't reachable (a laptop elsewhere, gitlab.com's shared
# runners), build with --build-arg NPM_PROXY= and npm goes direct. Only this
# build stage sees it; the final image has no npm.
ARG NPM_PROXY="http://192.168.137.120:8080"
RUN if [ -n "$NPM_PROXY" ]; then npm config set proxy "$NPM_PROXY" && npm config set https-proxy "$NPM_PROXY"; fi
COPY package*.json ./
# Exactly what package-lock.json pins, the same install code_test checks.
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# The nginx image renders /etc/nginx/templates/*.template into conf.d at start,
# so the API it proxies to is set per environment without a rebuild.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=soc-core-api
ENV BACKEND_PORT=8000
EXPOSE 80
