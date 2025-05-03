FROM oven/bun

COPY bun.lock . 
COPY package.json . 

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["bun", "src/api/index.ts"]
