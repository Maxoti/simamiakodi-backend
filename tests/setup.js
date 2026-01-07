



const { cleanDatabase, testPool } = require('./testDatabase'); require('dotenv').config(); 
console.log('starting tests.....'); // Clean database before all tests start beforeAll(async () => { await cleanDatabase(); }); // Clean database before each test to ensure isolation beforeEach(async () => { await cleanDatabase(); }); // Clean and close connections after all tests afterAll(async () => { await cleanDatabase(); await testPool.end(); // Give time for connections to close gracefully 
// await new Promise(resolve => setTimeout(resolve, 500)); console.log('Tests completed'); });