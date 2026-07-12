const http = require('http');

function makeRequest(method, path, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;

        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                const parsedBody = responseData ? JSON.parse(responseData) : null;
                resolve({ statusCode: res.statusCode, body: parsedBody });
            });
        });

        req.on('error', (err) => reject(err));

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

async function runTests() {
    // 1. No token — blocked
    const noTokenResult = await makeRequest('POST', '/api/books', {
        title: 'Unauthorized Book',
        published_year: 2020,
        author_id: 1
    });
    console.log('POST /api/books (no token):', noTokenResult.statusCode, noTokenResult.body);

    // 2. Log in
    const loginResult = await makeRequest('POST', '/api/login', {
        username: 'patrickruk',
        password: 'securePass123'
    });
    const realToken = loginResult.body.token;

    // 3. Create a book WITH the valid token
    const withTokenResult = await makeRequest('POST', '/api/books',
        { title: 'Authorized Book', published_year: 2021, author_id: 1 },
        { Authorization: `Bearer ${realToken}` }
    );
    console.log('POST /api/books (valid token):', withTokenResult.statusCode, withTokenResult.body);

// 4. Try with a fake/tampered token
const fakeTokenResult = await makeRequest('POST', '/api/books',
    { title: 'Fake Token Book', published_year: 2022, author_id: 1 },
    { Authorization: 'Bearer this.is.not.a.real.token' }
);
console.log('POST /api/books (fake token):', fakeTokenResult.statusCode, fakeTokenResult.body);

}

runTests();