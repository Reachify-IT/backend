FROM node:alpine3.20

RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set the Puppeteer executable path (important for Alpine)...
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser


WORKDIR /app
COPY package.json ./


RUN npm install
RUN npm install puppeteer-core
RUN npm i helmet
RUN npm i compression
RUN npm i winston
COPY . .
EXPOSE 8000
CMD [ "npm", "run", "dev" ]

