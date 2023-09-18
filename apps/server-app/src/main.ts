import rc from 'rc';
import * as dgram from 'dgram';
import debug from 'debug';
import * as packet from 'native-dns-packet';

import { RECORDS, createAnswer, listAnswer, queryns } from './util';

const PORT = parseInt(process.env.PORT) || 53;
const EXTERNAL_DNS = process.env.EXTERNAL_DNS || '8.8.8.8, 8.8.4.4';


const opts = rc('dnsproxy', {
  host: '0.0.0.0',
  logging: process.env.DEBUG || 'dnsproxy:query',
  fallback_timeout: 350,
  port: PORT,
  nameservers: EXTERNAL_DNS.split(','),
  hosts: {} as { [key: string]: string },
  domains: {} as { [key: string]: string },
  servers: {} as { [key: string]: string },
});

const d = opts.logging.split(',');
d.push('dnsproxy:error');
opts.logging = d.join(',');
debug.enable(opts.logging);

console.log(opts);

const logdebug = debug('dnsproxy:debug');
const logquery = debug('dnsproxy:query');
const logerror = debug('dnsproxy:error');

logdebug('options: %j', opts);
const server = dgram.createSocket('udp4');

server.on('listening', () => {
  const address = server.address();
  console.log(`dns server listening ${address.address}:${address.port}`);
})

server.on('error', err => logerror('Server Error: %s', err));

server.on('message', (message, rinfo) => {
  const query = packet.parse(message);
  const domain = query.question[0].name;
  const type = query.question[0].type;

  logdebug('query: %j', query);

  for (const key in opts.hosts) {
    if (Object.prototype.hasOwnProperty.call(opts.hosts, key)) {
      if (domain != key) {
        continue;
      }
      const answer = opts.hosts[opts.hosts[key]] || opts.hosts[key];

      logquery('type: host, domain: %s, answer: %s', domain, answer);

      const res = createAnswer(query, answer);
      server.send(res, 0, res.length, rinfo.port, rinfo.address);
      return;
    }
  }

  for (const key in opts.domains) {
    if (Object.prototype.hasOwnProperty.call(opts.domains, key)) {
      const sLen = key.length;
      const dLen = domain.length;
      const keyOccurinDomain = domain.indexOf(key);

      if (keyOccurinDomain < 0) {
        continue;
      }
      if (keyOccurinDomain !== (dLen - sLen)) {
        continue;
      }
      if (keyOccurinDomain > 0) {
        if (!key.startsWith('.')) {
          continue;
        }
      }
      const answer = opts.domains[opts.domains[key]] || opts.domains[key];
      logquery('type: server, domain: %s, answer: %s', domain, opts.domains[key]);

      const res = createAnswer(query, answer);
      server.send(res, 0, res.length, rinfo.port, rinfo.address);
      return;
    }
  }

  const nameserver = (() => {
    for (const key in opts.servers) {
      if (Object.prototype.hasOwnProperty.call(opts.servers, key)) {
        if (domain.indexOf(key) !== -1) {
          return opts.servers[key];
        }
      }
    }
    return undefined;
  })() || opts.nameservers[0];

  queryns(message, rinfo, nameserver, opts.fallback_timeout)
    .then(result => {
      logquery('type: primary, nameserver: %s, query: %s, type: %s, answer: %s',
        nameserver, domain, RECORDS[type] || 'UNKNOWN', listAnswer(result));
      server.send(result, 0, result.length, rinfo.port, rinfo.address);
    })
    .catch(err => {
      logerror('Socket Error: %s', err);
      process.exit();
    });

  nameserver.length;

});

server.bind(opts.port, opts.host);
