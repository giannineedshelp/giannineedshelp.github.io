'use strict';

module.exports = {
  // Sparx API endpoints
  SPARX_API: {
    TOKEN: 'https://api.sparx-learning.com/oauth2/token',
    TOKEN_V2: 'https://api.sparx-learning.com/v2/oauth2/token',
    TOKEN_DIRECT: 'https://api.sparx-learning.com/auth/token',
    GRPC_HOMEWORKS: 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/GetHomeworkForCurrentStudent',
    GRPC_START_ACTIVITY: 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/RegisterActivityStart',
    GRPC_ANSWER: 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/AnswerQuestion',
    HEALTH: 'https://api.sparx-learning.com/health',
    SCHOOLS_DATA: 'https://static.sparx-learning.com/sl/spx001/data.txt',
  },

  // Sparx Maths website URLs (for browser automation)
  SPARX_WEB: {
    LOGIN: 'https://maths.sparx-learning.com/',
    DASHBOARD: 'https://maths.sparx-learning.com/student/dashboard',
    HOMEWORK: 'https://maths.sparx-learning.com/student/homework',
  },

  // Client credentials
  CLIENT_ID: 'sparx-maths-web',

  // User-Agents
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  ],

  // Default automation settings
  SETTINGS: {
    delayMin: 5,
    delayMax: 15,
    showWorking: true,
    aiProvider: 'openai',
  },

  // Google Cloud Vision API key (for captcha solving if needed)
  GCV_API_KEY: '',

  // Path to Chromium executable (for puppeteer)
  CHROMIUM_PATH: '',
};

