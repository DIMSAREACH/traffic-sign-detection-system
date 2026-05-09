# Render: Web Service → Root Directory = frontend-user, Dockerfile path = Dockerfile
# Set these in the service Environment (they are available at image build time on Render):
#   VITE_API_URL, VITE_PORTAL_SURFACE, optional OAuth VITE_* IDs

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time configuration (Vite inlines VITE_* at build)
ARG VITE_API_URL=
ARG VITE_PORTAL_SURFACE=user
ARG VITE_ADMIN_PORT=
ARG VITE_ADMIN_HOSTNAME=
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_GITHUB_CLIENT_ID=
ARG VITE_FACEBOOK_APP_ID=
ARG VITE_MICROSOFT_CLIENT_ID=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PORTAL_SURFACE=$VITE_PORTAL_SURFACE
ENV VITE_ADMIN_PORT=$VITE_ADMIN_PORT
ENV VITE_ADMIN_HOSTNAME=$VITE_ADMIN_HOSTNAME
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_GITHUB_CLIENT_ID=$VITE_GITHUB_CLIENT_ID
ENV VITE_FACEBOOK_APP_ID=$VITE_FACEBOOK_APP_ID
ENV VITE_MICROSOFT_CLIENT_ID=$VITE_MICROSOFT_CLIENT_ID

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Render injects PORT; default 8080 for local `docker run -p 8080:8080`
CMD ["/bin/sh", "-c", "sed -i \"s/listen 8080;/listen ${PORT:-8080};/\" /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
