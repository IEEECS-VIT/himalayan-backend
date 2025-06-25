FROM node:20

WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install

RUN pnpm build

EXPOSE 9000

CMD ["pnpm", "start"]
