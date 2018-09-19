FROM node:10-alpine
COPY package*.json /src
WORKDIR /src
RUN npm install