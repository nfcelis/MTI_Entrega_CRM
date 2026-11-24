#!/bin/bash
# Arranque de Frappe v16 + Frappe CRM v1.92.0 (mismo stack que Frappe Cloud).
# La primera vez instala todo (10-25 min); después solo arranca.
FRAPPE_BRANCH=version-16
CRM_VERSION=v1.92.0

if [ -d "/home/frappe/frappe-bench/apps/crm" ]; then
    echo "Bench already exists, skipping init"
    cd frappe-bench
    bench start
    exit 0
fi

echo "Creating new bench..."
rm -rf /home/frappe/frappe-bench
# El cliente MariaDB de la imagen exige SSL y el servidor local no lo usa
printf "[client]\nskip-ssl\n" > ~/.my.cnf

bench init --skip-redis-config-generation frappe-bench --frappe-branch "$FRAPPE_BRANCH" --python python3.14 || exit 1
cd frappe-bench

bench set-mariadb-host mariadb
bench set-redis-cache-host redis://redis:6379
bench set-redis-queue-host redis://redis:6379
bench set-redis-socketio-host redis://redis:6379
sed -i '/redis/d' ./Procfile
sed -i '/watch/d' ./Procfile

bench get-app crm --branch "$CRM_VERSION" || exit 1

bench new-site crm.localhost --force --mariadb-root-password 123 --admin-password admin --no-mariadb-socket || exit 1
bench --site crm.localhost install-app crm
# Igual que en Frappe Cloud: sin Server Scripts. Todo se configura con elementos estándar.
bench --site crm.localhost set-config mute_emails 1
bench --site crm.localhost set-config host_name "http://localhost:8000"
bench --site crm.localhost enable-scheduler
bench use crm.localhost

bench start
