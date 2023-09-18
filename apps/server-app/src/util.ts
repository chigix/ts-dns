import { parse, write, Packet } from 'native-dns-packet';
import * as dgram from 'dgram';

export const RECORDS = {
  '1': 'A',
  '2': 'NS',
  '5': 'CNAME',
  '6': 'SOA',
  '12': 'PTR',
  '15': 'MX',
  '16': 'TXT',
  '28': 'AAAA',
};

export function listAnswer(resp: Buffer) {
  const results = [];
  const res = parse(resp);
  res.answer.map(res => results.push(res.address || res.data));
  return results.join(', ') || 'nxdomain';
}

export function createAnswer(query: Packet, answer: string) {
  query.header.qr = 1;
  query.header.rd = 1;
  query.header.ra = 1;
  query.answer.push({
    name: query.question[0].name,
    type: 1,
    class: 1,
    ttl: 30,
    address: answer,
  });
  const buf = Buffer.alloc(4096);
  const wrt = write(buf, query);

  return buf.subarray(0, wrt);
}


export function queryns(message: Buffer, rinfo: dgram.RemoteInfo, nameserver: string, timeout: number) {
  return _queryns(message, rinfo, nameserver, {
    time: timeout, resolved: false,
  });
}

function _queryns(message: Buffer, rinfo: dgram.RemoteInfo, nameserver: string,
  timeoutCtx: {
    time: number,
    resolved: boolean,
  }): Promise<Buffer> {
  const sock = dgram.createSocket('udp4');
  return new Promise<Buffer>((resolve, reject) => {
    sock.send(message, 0, message.length, 53, nameserver, () => {
      setTimeout(() => {
        if (timeoutCtx.resolved) {
          return;
        }
        resolve(_queryns(message, rinfo, nameserver, timeoutCtx));
      }, timeoutCtx.time);
    });

    sock.on('error', err => {
      reject(err);
    });

    sock.on('message', response => {
      timeoutCtx.resolved = true;
      sock.close();
      resolve(response);
    });
  });
}
