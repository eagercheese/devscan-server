require('dotenv').config();
const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const nock = require('nock');

describe('Scan Links API (ML Integration)', () => {
  beforeAll(() => {
    // Mock ML service
    nock('http://localhost:5000')
      .post('/analyze')
      .reply(200, [{ isMalicious: false, anomalyScore: 0.1, classificationScore: 0.9, intelMatch: 'none' }]);
  });

  it('should return a result for a new link', async () => {
    // You may need to create a session and engineVersion first
    const sessionRes = await request(app)
      .post('/api/scan-sessions')
      .send({ browserInfo: 'TestBrowser', engineVersion: '1.0.0' });
    const session_ID = sessionRes.body.session_ID;
    const res = await request(app)
      .post('/api/scan-links')
      .send({ session_ID, links: ['https://example.com'] });
    expect(res.statusCode).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
  });
});
