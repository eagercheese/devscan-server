require('dotenv').config();
const request = require('supertest');
const express = require('express');
const app = require('../src/app');

describe('Scan Results API', () => {
  it('should fail to submit scan result with missing fields', async () => {
    const res = await request(app)
      .post('/api/scan-results')
      .send({ isMalicious: false });
    expect(res.statusCode).toBe(400);
  });
});
