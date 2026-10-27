// Remove only this project's Kafka records, keeping topics and Docker volumes.
const { execFileSync } = require('child_process');
const path = require('path');

const composeFile = path.join(__dirname, '..', 'docker-compose.yml');
const topics = [
  'identity.events', 'driver.events', 'driver.location', 'booking.events',
  'trip.events', 'payment.events', 'notification.commands', 'notification.dlq'
];

function kafka(...args) {
  return execFileSync('docker', ['compose', '-f', composeFile, 'exec', '-T', 'kafka',
    `/opt/kafka/bin/${args[0]}`, ...args.slice(1)], { encoding: 'utf8' }).trim();
}

const existing = new Set(kafka('kafka-topics.sh', '--bootstrap-server', 'kafka:9092', '--list').split('\n'));
const partitions = [];
for (const topic of topics.filter(name => existing.has(name))) {
  const lines = kafka('kafka-get-offsets.sh', '--bootstrap-server', 'kafka:9092', '--topic', topic).split('\n');
  for (const line of lines) {
    const match = /^([^:]+):(\d+):(\d+)$/.exec(line.trim());
    if (!match || match[1] !== topic) throw new Error(`Unexpected Kafka offset: ${line}`);
    partitions.push({ topic, partition: Number(match[2]), offset: Number(match[3]) });
  }
}

if (partitions.length) {
  const command = 'file=$(mktemp); trap \'rm -f "$file"\' EXIT; cat > "$file"; /opt/kafka/bin/kafka-delete-records.sh --bootstrap-server kafka:9092 --offset-json-file "$file"';
  execFileSync('docker', ['compose', '-f', composeFile, 'exec', '-T', 'kafka', 'sh', '-c', command], {
    input: JSON.stringify({ partitions, version: 1 }),
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit']
  });
}
console.log(`Cleared records from ${partitions.length} Kafka partitions`);
