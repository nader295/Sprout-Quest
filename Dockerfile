FROM rust:1.83-alpine3.21 AS builder
WORKDIR /build

RUN apk add --no-cache musl-dev

ENV USER=appuser
ENV UID=10001
RUN adduser --disabled-password --gecos "" \
    --home "/nonexistent" --shell "/sbin/nologin" \
    --no-create-home --uid "${UID}" "${USER}"

COPY src/ src/
COPY locales/ locales/
COPY migrations/ migrations/
COPY Cargo.* ./

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV RUSTFLAGS='-C target-feature=-crt-static'
RUN cargo build --release && \
    mv target/release/dick-grower-bot /dickGrowerBot

FROM alpine:3.21
RUN apk add --no-cache libgcc
COPY --from=builder /dickGrowerBot /usr/local/bin/
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
USER appuser:appuser
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/dickGrowerBot"]
