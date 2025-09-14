#!/bin/bash

# Create directory structure
mkdir -p config/grafana/{provisioning/datasources,provisioning/dashboards,dashboards}
mkdir -p backups logs

 # Set correct permissions for postgres container
chmod 777 logs

# 1. PostgreSQL Configuration (config/postgresql.conf)
cat > config/postgresql.conf << 'EOF'
# PostgreSQL Production Configuration

# Connection Settings
listen_addresses = '*'
port = 5432
max_connections = 300                      # Increased for 8GB server
superuser_reserved_connections = 3

# Memory Settings (optimized for 8GB VPS with observability stack)
shared_buffers = 1GB                    # ~12.5% of RAM (leaving room for Grafana/Prometheus)
effective_cache_size = 4GB              # ~50% of RAM (OS + observability stack will use ~4GB)
work_mem = 16MB                         # Increased for better query performance
maintenance_work_mem = 256MB            # Increased for faster maintenance operations
dynamic_shared_memory_type = posix

# WAL Settings
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min
wal_buffers = 16MB

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 0
log_error_verbosity = default
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'ddl'

# Statistics
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all
# stats_temp_directory removed in PostgreSQL 15+

# Autovacuum
autovacuum = on
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
autovacuum_vacuum_scale_factor = 0.2
autovacuum_analyze_scale_factor = 0.1
autovacuum_vacuum_cost_delay = 20ms

# Performance Extensions
shared_preload_libraries = 'pg_stat_statements'

# pg_stat_statements
pg_stat_statements.max = 10000
pg_stat_statements.track = all
pg_stat_statements.save = on
EOF

# 2. PostgreSQL Host-Based Authentication (config/pg_hba.conf)
cat > config/pg_hba.conf << 'EOF'
# PostgreSQL Client Authentication Configuration File

# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    all             all             172.0.0.0/8             md5
host    all             all             10.0.0.0/8              md5
host    all             all             192.168.0.0/16          md5
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
EOF

# 3. Prometheus Configuration (config/prometheus.yml)
cat > config/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres_exporter:9187']
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node_exporter:9100']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          # - alertmanager:9093
EOF

# 4. PostgreSQL Exporter Queries (config/postgres_exporter_queries.yaml)
cat > config/postgres_exporter_queries.yaml << 'EOF'
pg_stat_user_tables:
  query: "SELECT schemaname, relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, n_tup_del, n_tup_hot_upd, n_live_tup, n_dead_tup, vacuum_count, autovacuum_count, analyze_count, autoanalyze_count FROM pg_stat_user_tables"
  metrics:
    - schemaname:
        usage: "LABEL"
        description: "Name of the schema that this table is in"
    - relname:
        usage: "LABEL"
        description: "Name of this table"
    - seq_scan:
        usage: "COUNTER"
        description: "Number of sequential scans initiated on this table"
    - seq_tup_read:
        usage: "COUNTER"
        description: "Number of live rows fetched by sequential scans"
    - idx_scan:
        usage: "COUNTER"
        description: "Number of index scans initiated on this table"
    - idx_tup_fetch:
        usage: "COUNTER"
        description: "Number of live rows fetched by index scans"
    - n_tup_ins:
        usage: "COUNTER"
        description: "Number of rows inserted"
    - n_tup_upd:
        usage: "COUNTER"
        description: "Number of rows updated"
    - n_tup_del:
        usage: "COUNTER"
        description: "Number of rows deleted"
    - n_tup_hot_upd:
        usage: "COUNTER"
        description: "Number of rows HOT updated"
    - n_live_tup:
        usage: "GAUGE"
        description: "Estimated number of live rows"
    - n_dead_tup:
        usage: "GAUGE"
        description: "Estimated number of dead rows"
    - vacuum_count:
        usage: "COUNTER"
        description: "Number of times this table has been manually vacuumed"
    - autovacuum_count:
        usage: "COUNTER"
        description: "Number of times this table has been vacuumed by the autovacuum daemon"

pg_stat_statements:
  query: "SELECT query, calls, total_exec_time, mean_exec_time, stddev_exec_time, rows, 100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 100"
  metrics:
    - query:
        usage: "LABEL"
        description: "Query text"
    - calls:
        usage: "COUNTER"
        description: "Number of times executed"
    - total_exec_time:
        usage: "COUNTER"
        description: "Total time spent executing this statement"
    - mean_exec_time:
        usage: "GAUGE"
        description: "Mean time spent executing this statement"
    - stddev_exec_time:
        usage: "GAUGE"
        description: "Population standard deviation of time spent executing this statement"
    - rows:
        usage: "COUNTER"
        description: "Total number of rows retrieved or affected by the statement"
    - hit_percent:
        usage: "GAUGE"
        description: "Percentage of buffer hits for this statement"
EOF

# 5. Loki Configuration (config/loki-config.yml)
cat > config/loki-config.yml << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
  filesystem:
    directory: /loki/chunks

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  allow_structured_metadata: false

# chunk_store_config deprecated in newer Loki versions

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

ruler:
  storage:
    type: local
    local:
      directory: /loki/rules
  rule_path: /loki/rules
  alertmanager_url: http://localhost:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
EOF

# 6. Promtail Configuration (config/promtail-config.yml)
cat > config/promtail-config.yml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: postgresql
    static_configs:
      - targets:
          - localhost
        labels:
          job: postgresql
          __path__: /var/log/postgresql/*.log

  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/host/syslog
EOF

# 7. Grafana Datasource Provisioning (config/grafana/provisioning/datasources/datasources.yml)
cat > config/grafana/provisioning/datasources/datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
EOF

# 8. Grafana Dashboard Provisioning (config/grafana/provisioning/dashboards/dashboards.yml)
cat > config/grafana/provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

# 9. Environment Variables Template (.env)
cat > .env.example << 'EOF'
# Database Configuration
DB_NAME=myapp
DB_USER=appuser
DB_PASSWORD=your_secure_password_here

# Grafana Configuration
GRAFANA_PASSWORD=your_grafana_password_here

# pgAdmin Configuration
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=your_pgadmin_password_here
EOF

echo "Configuration files created successfully!"
echo ""
echo "Directory structure:"
echo "  ./          - Application files"
echo "  /var/lib/postgres-stack/      - Data directories"  
echo "  /var/backups/postgres/        - Database backups"
echo "  /var/log/postgres-stack/      - Log files"
echo ""
echo "Next steps:"
echo "1. cd /opt/postgres-stack"
echo "2. Copy .env.example to .env and fill in your passwords"
echo "3. Adjust PostgreSQL memory settings in config/postgresql.conf based on your VPS specs"
echo "4. Run: docker-compose up -d"
echo "5. Import your database backup"
echo "6. Access Grafana at http://your-vps-ip:3000"
echo "7. Access pgAdmin at http://your-vps-ip:8080"
