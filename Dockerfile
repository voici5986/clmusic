FROM node:22-slim as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base as build
RUN --mount=type=cache,id=npm,target=/npm/store  npm i --frozen-lockfile
RUN npm run build

# Production stage
FROM nginx:alpine-slim as production-stage
COPY ./conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]