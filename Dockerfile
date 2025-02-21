FROM node:alpine3.20
WORKDIR /app
COPY package.json ./
RUN npm install
RUN npm i helmet
RUN npm i compression
RUN npm i winston
COPY . .
EXPOSE 8000
CMD [ "npm", "run", "dev" ]