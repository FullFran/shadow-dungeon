# Shadow Dungeon API: PocketBase built as a Go framework into one static binary.

FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/sd-api .

FROM alpine:3.22
# ca-certificates: OAuth2 token exchange (HTTPS) and SMTP over TLS (Resend).
RUN apk add --no-cache ca-certificates \
 && adduser -D -H -u 10001 sdapi \
 && mkdir /pb_data && chown sdapi:sdapi /pb_data
COPY --from=build /out/sd-api /usr/local/bin/sd-api
USER sdapi
VOLUME /pb_data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/usr/local/bin/sd-api"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
