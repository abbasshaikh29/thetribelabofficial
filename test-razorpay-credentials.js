#!/usr/bin/env node

/**
 * Test script to verify Razorpay credentials
 * This script tests the API credentials by making a simple API call
 */

require('dotenv').config({ path: '.env.development' });

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

console.log('🔍 Testing Razorpay Credentials...\n');

// Check if credentials are set
console.log('Environment Variables:');
console.log('RAZORPAY_KEY_ID:', RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 8)}...` : 'NOT SET');
console.log('RAZORPAY_KEY_SECRET:', RAZORPAY_KEY_SECRET ? `${RAZORPAY_KEY_SECRET.substring(0, 8)}...` : 'NOT SET');
console.log('');

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('❌ Missing Razorpay credentials in environment variables');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.development');
  process.exit(1);
}

// Test API call
async function testCredentials() {
  try {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    console.log('🔄 Making test API call to Razorpay...');
    
    // Try to fetch account details (simple API call)
    const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response Status:', response.status);
    console.log('Response Status Text:', response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Credentials are valid!');
      console.log('Account accessible, found', data.count || 0, 'payments');
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ API call failed:');
      console.error('Status:', response.status);
      console.error('Error:', errorData);
      
      if (response.status === 401) {
        console.error('\n🔍 Authentication failed. This could mean:');
        console.error('1. Your RAZORPAY_KEY_ID is incorrect');
        console.error('2. Your RAZORPAY_KEY_SECRET is incorrect');
        console.error('3. You\'re using test credentials but the API expects live credentials (or vice versa)');
        console.error('4. Your credentials are from a different Razorpay account');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

// Test subscription API specifically
async function testSubscriptionAPI() {
  try {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    console.log('\n🔄 Testing subscription API access...');
    
    // Try to fetch subscriptions
    const response = await fetch('https://api.razorpay.com/v1/subscriptions?count=1', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Subscription API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Subscription API accessible!');
      console.log('Found', data.count || 0, 'subscriptions');
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ Subscription API call failed:');
      console.error('Status:', response.status);
      console.error('Error:', errorData);
      return false;
    }
  } catch (error) {
    console.error('❌ Subscription API network error:', error.message);
    return false;
  }
}

// Test specific subscription ID
async function testSpecificSubscription() {
  const subscriptionId = 'sub_QhXTvrfCNmbUrA'; // From your error logs
  
  try {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    console.log(`\n🔄 Testing specific subscription: ${subscriptionId}...`);
    
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Specific Subscription Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Subscription found!');
      console.log('Subscription Status:', data.status);
      console.log('Plan ID:', data.plan_id);
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ Specific subscription call failed:');
      console.error('Status:', response.status);
      console.error('Error:', errorData);
      
      if (response.status === 400 && errorData.error?.description?.includes('does not exist')) {
        console.error('\n🔍 This subscription ID does not exist in your Razorpay account.');
        console.error('This could mean:');
        console.error('1. The subscription was created with different credentials');
        console.error('2. The subscription ID is from a different Razorpay account');
        console.error('3. The subscription was deleted');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Specific subscription network error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Running Razorpay Credential Tests\n');
  
  const basicTest = await testCredentials();
  const subscriptionTest = await testSubscriptionAPI();
  const specificTest = await testSpecificSubscription();
  
  console.log('\n📊 Test Results:');
  console.log('Basic API Access:', basicTest ? '✅ PASS' : '❌ FAIL');
  console.log('Subscription API Access:', subscriptionTest ? '✅ PASS' : '❌ FAIL');
  console.log('Specific Subscription Access:', specificTest ? '✅ PASS' : '❌ FAIL');
  
  if (basicTest && subscriptionTest) {
    console.log('\n🎉 Your Razorpay credentials are working correctly!');
    if (!specificTest) {
      console.log('\n⚠️  However, the specific subscription ID in your database may be from a different account.');
    }
  } else {
    console.log('\n❌ There are issues with your Razorpay credentials.');
    console.log('\n🔧 Next steps:');
    console.log('1. Verify your credentials in the Razorpay dashboard');
    console.log('2. Make sure you\'re using the correct environment (test vs live)');
    console.log('3. Check if your account has the necessary permissions');
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

runAllTests().catch(console.error);
