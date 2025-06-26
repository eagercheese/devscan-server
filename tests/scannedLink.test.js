require('dotenv').config();
const request = require('supertest');
const express = require('express');
const app = require('../src/app');

describe('Scanned Link API', () => {
  it('should fail to submit a link with missing fields', async () => {
    const res = await request(app)
      .post('/api/scanned-links')
      .send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(400);
  });
});
