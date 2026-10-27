const url = 'http://localhost:8000/health/services';

async function main() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const body = await response.json();
        if (body.services?.length === 7 && body.services.every(service => service.status === 'up')) {
          console.log('Gateway and all seven services are healthy');
          return;
        }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Services did not become healthy after the seed rebuild');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
