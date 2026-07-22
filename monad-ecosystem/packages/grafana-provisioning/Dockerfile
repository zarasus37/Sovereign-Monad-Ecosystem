FROM grafana/grafana:11.2.0
COPY datasources/ /etc/grafana/provisioning/datasources/
COPY dashboards/ /etc/grafana/provisioning/dashboards/
COPY dashboards.json /var/lib/grafana/dashboards/default.json
EXPOSE 3000
