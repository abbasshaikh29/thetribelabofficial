/**
 * Security Testing Script
 * Tests various security implementations in the application
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to log test results
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name}`);
  if (details) console.log(`   ${details}`);
  
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

// ============================================================================
// SECURITY HEADER TESTS
// ============================================================================

async function testSecurityHeaders() {
  console.log('\n🔒 Testing Security Headers...');
  
  const response = await makeRequest(BASE_URL);
  const headers = response.headers;
  
  // Test for security headers
  const securityHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'referrer-policy'
  ];
  
  securityHeaders.forEach(header => {
    const exists = headers[header];
    logTest(
      `Security Header: ${header}`,
      !!exists,
      exists ? `Value: ${exists}` : 'Header missing'
    );
  });
  
  // Test X-Powered-By header is removed
  logTest(
    'X-Powered-By header removed',
    !headers['x-powered-by'],
    headers['x-powered-by'] ? 'Header still present' : 'Header properly removed'
  );
}

// ============================================================================
// CORS TESTS
// ============================================================================

async function testCORS() {
  console.log('\n🌐 Testing CORS Configuration...');
  
  // Test with malicious origin
  const maliciousResponse = await makeRequest(`${API_BASE}/secure-example`, {
    method: 'GET',
    headers: {
      'Origin': 'https://malicious-site.com'
    }
  });
  
  logTest(
    'CORS blocks malicious origins',
    maliciousResponse.status === 403 || !maliciousResponse.headers['access-control-allow-origin'],
    `Status: ${maliciousResponse.status}`
  );
  
  // Test with legitimate origin (localhost for development)
  const legitimateResponse = await makeRequest(`${API_BASE}/secure-example`, {
    method: 'GET',
    headers: {
      'Origin': 'http://localhost:3000'
    }
  });
  
  logTest(
    'CORS allows legitimate origins',
    legitimateResponse.status !== 403,
    `Status: ${legitimateResponse.status}`
  );
}

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

async function testInputValidation() {
  console.log('\n🛡️ Testing Input Validation...');
  
  // Test XSS payload
  const xssPayload = {
    content: '<script>alert("XSS")</script>Hello World'
  };
  
  const xssResponse = await makeRequest(`${API_BASE}/secure-example`, {
    method: 'POST',
    body: JSON.stringify(xssPayload)
  });
  
  logTest(
    'XSS payload rejected',
    xssResponse.status === 400 || xssResponse.status === 401,
    `Status: ${xssResponse.status}`
  );
  
  // Test SQL injection payload
  const sqlPayload = {
    username: "admin'; DROP TABLE users; --",
    email: 'test@example.com'
  };
  
  const sqlResponse = await makeRequest(`${API_BASE}/secure-example`, {
    method: 'POST',
    body: JSON.stringify(sqlPayload)
  });
  
  logTest(
    'SQL injection payload rejected',
    sqlResponse.status === 400 || sqlResponse.status === 401,
    `Status: ${sqlResponse.status}`
  );
  
  // Test oversized payload
  const oversizedPayload = {
    content: 'A'.repeat(10000) // 10KB of data
  };
  
  const oversizedResponse = await makeRequest(`${API_BASE}/secure-example`, {
    method: 'POST',
    body: JSON.stringify(oversizedPayload)
  });
  
  logTest(
    'Oversized payload rejected',
    oversizedResponse.status === 400 || oversizedResponse.status === 413,
    `Status: ${oversizedResponse.status}`
  );
}

// ============================================================================
// RATE LIMITING TESTS
// ============================================================================

async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting...');
  
  const startTime = performance.now();
  const requests = [];
  
  // Make multiple rapid requests
  for (let i = 0; i < 15; i++) {
    requests.push(makeRequest(`${API_BASE}/secure-example`));
  }
  
  const responses = await Promise.all(requests);
  const rateLimitedResponses = responses.filter(r => r.status === 429);
  
  logTest(
    'Rate limiting active',
    rateLimitedResponses.length > 0,
    `${rateLimitedResponses.length} requests rate limited out of ${responses.length}`
  );
  
  // Check for rate limit headers
  const rateLimitResponse = responses.find(r => r.headers['x-ratelimit-limit']);
  logTest(
    'Rate limit headers present',
    !!rateLimitResponse,
    rateLimitResponse ? 'Headers found' : 'No rate limit headers'
  );
}

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  // Test unauthenticated request to protected endpoint
  const unauthResponse = await makeRequest(`${API_BASE}/user/settings`, {
    method: 'PUT',
    body: JSON.stringify({ bio: 'test' })
  });
  
  logTest(
    'Protected endpoint requires authentication',
    unauthResponse.status === 401,
    `Status: ${unauthResponse.status}`
  );
  
  // Test invalid session token
  const invalidTokenResponse = await makeRequest(`${API_BASE}/user/settings`, {
    method: 'PUT',
    headers: {
      'Cookie': 'next-auth.session-token=invalid-token'
    },
    body: JSON.stringify({ bio: 'test' })
  });
  
  logTest(
    'Invalid session token rejected',
    invalidTokenResponse.status === 401,
    `Status: ${invalidTokenResponse.status}`
  );
}

// ============================================================================
// FILE UPLOAD SECURITY TESTS
// ============================================================================

async function testFileUploadSecurity() {
  console.log('\n📁 Testing File Upload Security...');
  
  // Test malicious file extension
  const maliciousFile = {
    fileName: 'malicious.exe',
    fileType: 'application/x-executable',
    fileSize: 1024
  };
  
  const maliciousResponse = await makeRequest(`${API_BASE}/upload/r2`, {
    method: 'POST',
    body: JSON.stringify(maliciousFile)
  });
  
  logTest(
    'Malicious file extension blocked',
    maliciousResponse.status === 400 || maliciousResponse.status === 401,
    `Status: ${maliciousResponse.status}`
  );
  
  // Test oversized file
  const oversizedFile = {
    fileName: 'large.jpg',
    fileType: 'image/jpeg',
    fileSize: 200 * 1024 * 1024 // 200MB
  };
  
  const oversizedFileResponse = await makeRequest(`${API_BASE}/upload/r2`, {
    method: 'POST',
    body: JSON.stringify(oversizedFile)
  });
  
  logTest(
    'Oversized file blocked',
    oversizedFileResponse.status === 400 || oversizedFileResponse.status === 413 || oversizedFileResponse.status === 401,
    `Status: ${oversizedFileResponse.status}`
  );
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runSecurityTests() {
  console.log('🚀 Starting Security Tests...');
  console.log(`Testing against: ${BASE_URL}`);
  
  try {
    await testSecurityHeaders();
    await testCORS();
    await testInputValidation();
    await testRateLimiting();
    await testAuthentication();
    await testFileUploadSecurity();
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.details}`);
        });
    }
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityTests();
}

export { runSecurityTests };
