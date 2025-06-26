require('dotenv').config();
const request = require('supertest');
const express = require('express');
const app = require('../src/app');

describe('Scan Session API', () => {
  it('should create a scan session', async () => {
    const res = await request(app)
      .post('/api/scan-sessions')
      .send({ browserInfo: 'TestBrowser', engineVersion: '1.0.0' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('session_ID');
  });

  it('should fail with missing fields', async () => {
    const res = await request(app)
      .post('/api/scan-sessions')
      .send({ browserInfo: 'TestBrowser' });
    expect(res.statusCode).toBe(400);
  });
});
