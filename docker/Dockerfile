# One image, two portals: build with APP=business or APP=investor.
#
# The whole workspace goes in, not just the app. The portals import @rf/privy and the two
# @rf/contracts-* packages as workspace links, and those read deployed.json files beside
# themselves at runtime — a slimmed standalone build would leave the portal pointing at
# contracts it could no longer find.
FROM node:24-bookworm-slim AS build
ARG APP
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/business/package.json apps/business/
COPY apps/investor/package.json apps/investor/
COPY apps/e2e/package.json apps/e2e/
COPY libs/privy/package.json libs/privy/
COPY libs/shared/package.json libs/shared/
COPY contracts/ens/package.json contracts/ens/
COPY contracts/hedera-ats/package.json contracts/hedera-ats/
COPY tools/proof/package.json tools/proof/
RUN npm ci --ignore-scripts

COPY . .

# NEXT_PUBLIC_* is inlined at build time, so Railway's service variables have to reach this
# stage — Railway passes them as build args by default; nothing here needs declaring.
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_BUSINESS_PORTAL_URL
RUN npm run build -w @rf/${APP}

FROM node:24-bookworm-slim
ARG APP
ENV APP=${APP} NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Where the three demo state files live; mount a Railway volume here.
ENV DEMO_STATE_DIR=/data
WORKDIR /app
COPY --from=build /app /app
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
