// Publish committed outbox rows to Kafka; a failed send stays pending for retry.
function startOutboxRelay(pool, producer, intervalMs = 1000) {
  let busy = false;
  async function flush() {
    if (busy) return;
    busy = true;
    try {
      const { rows } = await pool.query(
        "SELECT id, topic, event_type, partition_key, payload FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at LIMIT 20"
      );
      for (const row of rows) {
        try {
          await producer.send({ topic: row.topic, messages: [{
            key: row.partition_key || String(row.id),
            value: JSON.stringify({ eventType: row.event_type, data: row.payload })
          }] });
          await pool.query("UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1", [row.id]);
        } catch (error) {
          console.warn(`[OUTBOX] ${row.topic} ${row.id}: ${error.message}`);
          break;
        }
      }
    } catch (error) {
      console.warn(`[OUTBOX] query failed: ${error.message}`);
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(flush, intervalMs);
  timer.unref();
  void flush();
  return timer;
}

module.exports = { startOutboxRelay };
