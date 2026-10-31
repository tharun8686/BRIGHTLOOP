import { createServer } from 'node:net';

/** In-memory SMTP server for tests only. It never relays messages externally. */
export async function startSmtpSink() {
  const messages: { recipient: string; body: string }[] = [];
  const server = createServer((socket) => {
    socket.write('220 localhost Brightloop test SMTP\r\n');
    let buffer = '',
      body = '',
      recipient = '',
      readingData = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let boundary: number;
      while ((boundary = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (readingData) {
          if (line === '.') {
            messages.push({ recipient, body });
            body = '';
            readingData = false;
            socket.write('250 accepted for local test\r\n');
          } else body += line.replace(/^\.\./, '.') + '\r\n';
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250 localhost\r\n');
        else if (/^RCPT TO:/i.test(line)) {
          recipient = line.match(/<([^>]+)>/)?.[1] || '';
          socket.write('250 recipient accepted\r\n');
        } else if (line === 'DATA') {
          readingData = true;
          socket.write('354 end with dot\r\n');
        } else if (line === 'QUIT') socket.end('221 goodbye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as { port: number }).port,
    messages,
    latestLink(recipient: string) {
      const message = messages.filter((m) => m.recipient === recipient).at(-1);
      if (!message) throw new Error('Expected transactional email was not received.');
      const decoded = message.body
        .replace(/=\r\n/g, '')
        .replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      const link = decoded.match(/http:\/\/127\.0\.0\.1:\d+\/auth\/[^\s]+/)?.[0];
      if (!link) throw new Error('Expected account link is missing from the test message.');
      return link;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
