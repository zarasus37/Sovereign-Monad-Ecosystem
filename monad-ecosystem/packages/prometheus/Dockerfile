FROM prom/prometheus:v2.54.1
COPY config/prometheus.yml /etc/prometheus/prometheus.yml
EXPOSE 9090
CMD ["--config.file=/etc/prometheus/prometheus.yml", "--web.enable-lifecycle"]
