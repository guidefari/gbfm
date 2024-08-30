FROM oven/bun:1 as base

WORKDIR /app

COPY ./backend/package.json .
COPY bun.lockb .

RUN bun i

FROM base as dev

COPY ./backend .

FROM dev as build

RUN bun run build

FROM base as prod

COPY --from=build /app/dist /app