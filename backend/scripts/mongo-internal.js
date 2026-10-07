const path = require('node:path');
const { execFileSync } = require('node:child_process');

const composeFile = path.join(__dirname, '..', 'docker-compose.yml');

function runMongoScript(script) {
  return execFileSync('docker', [
    'compose', '-f', composeFile, 'exec', '-T', 'notification-db',
    'sh', '-c',
    'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin notification_db --eval "$1"',
    'sh', script,
  ], { encoding: 'utf8' }).trim();
}

module.exports = { runMongoScript };
