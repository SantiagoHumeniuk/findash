const https = require('https');
const querystring = require('querystring');

const postData = querystring.stringify({
  'usu': 'aibarbia',
  'pass': 'Agus2901'
});

const req = https.request({
  hostname: 'calculadora.balanz.com',
  port: 443,
  path: '/calculadoraDeBonos/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Origin': 'https://calculadora.balanz.com',
    'Referer': 'https://calculadora.balanz.com/calculadoraDeBonos/login'
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (body.includes('Usuario o Clave Incorrectos') && res.statusCode === 200) {
      console.log('Result: Login still returning the form page (maybe incorrect credentials or another issue)');
    } else if (res.statusCode === 302) {
      console.log('Result: SUCCESS REDIRECT');
    } else {
      console.log('Result: OTHER - Length: ' + body.length);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
