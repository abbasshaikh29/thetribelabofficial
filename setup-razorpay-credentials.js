#!/usr/bin/env node

/**
 * Interactive script to help set up Razorpay credentials
 * This script guides you through getting and testing new credentials
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testCredentials(keyId, keySecret) {
  try {
    // Add fetch polyfill for Node.js
    if (typeof fetch === 'undefined') {
      global.fetch = require('node-fetch');
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Credentials are valid!');
      console.log(`Found ${data.count || 0} payments in your account`);
      return true;
    } else {
      const errorData = await response.json();
      console.log('❌ Credentials are invalid:');
      console.log('Status:', response.status);
      console.log('Error:', errorData.error?.description || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing credentials:', error.message);
    return false;
  }
}

function updateEnvFile(keyId, keySecret, webhookSecret = '', planId = '') {
  const envPath = '.env.development';
  
  try {
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add Razorpay credentials
    const updates = {
      'RAZORPAY_KEY_ID': keyId,
      'RAZORPAY_KEY_SECRET': keySecret,
      'NEXT_PUBLIC_RAZORPAY_KEY_ID': keyId,
    };
    
    if (webhookSecret) {
      updates['RAZORPAY_WEBHOOK_SECRET'] = webhookSecret;
    }
    
    if (planId) {
      updates['RAZORPAY_COMMUNITY_PLAN_ID'] = planId;
    }
    
    // Update existing variables or add new ones
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add to Razorpay section if it exists, otherwise append
        if (envContent.includes('# Razorpay')) {
          envContent = envContent.replace(
            /(# Razorpay.*?\n)/,
            `$1${key}=${value}\n`
          );
        } else {
          envContent += `\n# Razorpay Configuration\n${key}=${value}\n`;
        }
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated ${envPath} with new credentials`);
    
  } catch (error) {
    console.log('❌ Error updating environment file:', error.message);
    console.log('\nPlease manually update your .env.development file with:');
    console.log(`RAZORPAY_KEY_ID=${keyId}`);
    console.log(`RAZORPAY_KEY_SECRET=${keySecret}`);
    console.log(`NEXT_PUBLIC_RAZORPAY_KEY_ID=${keyId}`);
  }
}

async function main() {
  console.log('🔧 Razorpay Credentials Setup\n');
  
  console.log('This script will help you set up working Razorpay credentials.\n');
  
  console.log('📋 Before starting, please:');
  console.log('1. Login to your Razorpay Dashboard: https://dashboard.razorpay.com/');
  console.log('2. Go to Settings → API Keys');
  console.log('3. Generate new Test API keys (or Live keys if ready for production)');
  console.log('4. Copy the Key ID and Key Secret\n');
  
  const proceed = await question('Are you ready to proceed? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Please get your Razorpay credentials first and run this script again.');
    rl.close();
    return;
  }
  
  console.log('\n📝 Enter your Razorpay credentials:\n');
  
  const keyId = await question('Razorpay Key ID (starts with rzp_test_ or rzp_live_): ');
  if (!keyId || (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_'))) {
    console.log('❌ Invalid Key ID format. It should start with rzp_test_ or rzp_live_');
    rl.close();
    return;
  }
  
  const keySecret = await question('Razorpay Key Secret: ');
  if (!keySecret || keySecret.length < 10) {
    console.log('❌ Invalid Key Secret. Please check and try again.');
    rl.close();
    return;
  }
  
  console.log('\n🧪 Testing credentials...\n');
  
  const isValid = await testCredentials(keyId, keySecret);
  
  if (!isValid) {
    console.log('\n❌ The credentials you entered are not working.');
    console.log('Please check:');
    console.log('1. You copied the credentials correctly');
    console.log('2. The credentials are from the correct Razorpay account');
    console.log('3. Your Razorpay account is active and verified');
    rl.close();
    return;
  }
  
  console.log('\n🎉 Great! Your credentials are working.\n');
  
  const updateEnv = await question('Would you like to update your .env.development file? (y/n): ');
  if (updateEnv.toLowerCase() === 'y') {
    
    console.log('\n📋 Optional: Enter additional configuration (press Enter to skip):\n');
    
    const webhookSecret = await question('Webhook Secret (from Razorpay Dashboard → Settings → Webhooks): ');
    const planId = await question('Community Plan ID (from Razorpay Dashboard → Subscriptions → Plans): ');
    
    updateEnvFile(keyId, keySecret, webhookSecret, planId);
  }
  
  console.log('\n✅ Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart your development server');
  console.log('2. Run: node test-razorpay-credentials.js');
  console.log('3. Check your application logs for any remaining errors');
  
  if (keyId.startsWith('rzp_test_')) {
    console.log('\n⚠️  Note: You are using TEST credentials.');
    console.log('   - Test payments will not charge real money');
    console.log('   - Use test card numbers for testing');
    console.log('   - Switch to LIVE credentials for production');
  }
  
  rl.close();
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  rl.close();
});
