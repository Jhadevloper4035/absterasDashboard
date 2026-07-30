import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';

afterEach(() => {
  mock.restoreAll();
  mongoose.connection.readyState = 0;
});

test('connectDatabase rejects when MongoDB is not connected after connect returns', async () => {
  mock.method(mongoose, 'connect', async () => {
    mongoose.connection.readyState = 2;
  });

  await assert.rejects(connectDatabase(), /did not reach connected state: connecting/);
});

test('connectDatabase resolves only after MongoDB is connected', async () => {
  mock.method(mongoose, 'connect', async () => {
    mongoose.connection.readyState = 1;
  });

  await connectDatabase();

  assert.equal(mongoose.connection.readyState, 1);
});
