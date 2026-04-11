const axios = require('axios');

async function testApi() {
  try {
    const response = await axios.get('http://localhost:3001/api/patients');
    console.log('Patients:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApi();
