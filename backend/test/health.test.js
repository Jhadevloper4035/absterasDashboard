import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { app } from '../src/app.js';

function request(method, url) {
  return new Promise((resolve, reject) => {
    const req = new Readable({
      read() {
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {};

    const chunks = [];
    const res = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (name, value) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => res.headers[name.toLowerCase()];
    res.getHeaders = () => res.headers;
    res.removeHeader = (name) => {
      delete res.headers[name.toLowerCase()];
    };
    res.writeHead = (statusCode, headers = {}) => {
      res.statusCode = statusCode;
      Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
    };

    app.handle(req, res, reject);
  });
}

test('health reports degraded before MongoDB connects', async () => {
  try {
    const response = await request('GET', '/health');
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 503);
    assert.equal(body.status, 'degraded');
    assert.equal(body.database.state, 'disconnected');
  } finally {
    await mongoose.disconnect();
  }
});
