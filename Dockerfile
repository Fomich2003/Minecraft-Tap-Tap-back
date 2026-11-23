# Бекенд Minecraft Tap-Tap: Express API + Telegram-бот (long polling)
# Mongoose 9 вимагає Node >= 20.19, тому Node 22 LTS
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Спершу лише маніфести: шар із залежностями перезбирається тільки коли змінився package-lock
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Для роботи потрібні лише index.js і src/. temp/, test/ і .env відсікає .dockerignore
COPY index.js ./
COPY src ./src

# Не від root. Користувач node (uid 1000) уже є в образі
USER node

EXPOSE 6788
CMD ["node", "index.js"]
