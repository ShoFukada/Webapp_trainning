# Webapp用のDockerfile

FROM node:20
# FROM ubuntu:22.04
# アプリケーションの作業ディレクトリを指定
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
