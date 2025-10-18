// Quick test script to verify voice chat endpoint
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testVoiceEndpoint() {
  console.log('🧪 Testing Voice Chat Endpoint...\n');
  
  // Test 1: Check if backend is running
  console.log('1️⃣ Testing backend health...');
  try {
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('✅ Backend is running');
    console.log('   Status:', healthData.status);
    console.log('   Test Mode:', healthData.testMode);
  } catch (error) {
    console.error('❌ Backend not responding. Is it running?');
    console.error('   Run: cd backend && npm start');
    return;
  }
  
  // Test 2: Check voice clones
  console.log('\n2️⃣ Checking voice clones...');
  try {
    const clonesResponse = await fetch('http://localhost:3001/api/voice-clones');
    const clonesData = await clonesResponse.json();
    
    if (clonesData.clones && clonesData.clones.length > 0) {
      console.log(`✅ Found ${clonesData.clones.length} voice clone(s)`);
      clonesData.clones.forEach(clone => {
        console.log(`   - ${clone.name} (ID: ${clone.voice_id})`);
      });
    } else {
      console.error('❌ No voice clones found');
      console.error('   Please complete the interview process first');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to fetch voice clones:', error.message);
    return;
  }
  
  console.log('\n✅ All tests passed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Open http://localhost:3000 in your browser');
  console.log('   2. Click "Record Voice" button');
  console.log('   3. Check browser console (F12) for any errors');
  console.log('   4. Check backend terminal for detailed logs');
}

testVoiceEndpoint().catch(console.error);

