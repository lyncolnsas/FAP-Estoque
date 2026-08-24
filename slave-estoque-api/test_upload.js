const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

fs.writeFileSync('test.jpg', 'fake image content');

const form = new FormData();
form.append('file', fs.createReadStream('test.jpg'));

const req = http.request({
  host: 'localhost',
  port: 3333,
  path: '/upload',
  method: 'POST',
  headers: form.getHeaders()
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', console.error);
form.pipe(req);
