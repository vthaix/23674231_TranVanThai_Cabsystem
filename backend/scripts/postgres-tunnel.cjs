// Optional loopback-only access for host-side seed scripts and database tools.
const net = require('node:net');
net.createServer(client => {
  const upstream = net.connect(5432, 'postgres');
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
}).listen(5432, '0.0.0.0');
