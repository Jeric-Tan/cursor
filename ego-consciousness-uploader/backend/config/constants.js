// Configuration constants
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  USE_TEST_AUDIO: process.env.USE_TEST_AUDIO !== 'false', // Default true, set to 'false' to disable
  
  INTERVIEW_QUESTIONS: [
    "Tell me your name and a bit about yourself."
  ]
};

