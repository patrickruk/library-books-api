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
                console.log(`Raw response from ${path}:`, responseData);
                try {
                    const parsedBody = responseData ? JSON.parse(responseData) : null;
                    resolve({ statusCode: res.statusCode, body: parsedBody });
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                    resolve({ statusCode: res.statusCode, body: responseData });
                }
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
    // Step 1: Admin Login
    const loginResult = await makeRequest('POST', '/api/login', {
        username: 'patrickruk',
        password: 'securePass123'
    });
    console.log('POST /api/login:', loginResult.statusCode, loginResult.body);

    if (!loginResult.body || !loginResult.body.accessToken) {
        throw new Error('Admin login failed, no accessToken returned');
    }

    const accessToken = loginResult.body.accessToken;
    const originalRefreshToken = loginResult.body.refreshToken;

    // Step 2: Refresh with valid token
    const refreshResult1 = await makeRequest('POST', '/api/refresh-token', {
        refreshToken: originalRefreshToken
    });
    console.log('POST /api/refresh-token (valid):', refreshResult1.statusCode, refreshResult1.body);

    const newRefreshToken = refreshResult1.body.refreshToken;

    // Step 3: Refresh again with stale token
    const refreshResult2 = await makeRequest('POST', '/api/refresh-token', {
        refreshToken: originalRefreshToken
    });
    console.log('POST /api/refresh-token (stale):', refreshResult2.statusCode, refreshResult2.body);

    // Step 4: Refresh with new token
    const refreshResult3 = await makeRequest('POST', '/api/refresh-token', {
        refreshToken: newRefreshToken
    });
    console.log('POST /api/refresh-token (new valid):', refreshResult3.statusCode, refreshResult3.body);

    // Step 5: Test POST /api/books with invalid year
    const invalidYearResult = await makeRequest('POST', '/api/books', {
        title: 'Test Book',
        published_year: 'kigali',
        author_id: 1
    }, { Authorization: `Bearer ${accessToken}` });
    console.log('POST /api/books (invalid year):', invalidYearResult.statusCode, invalidYearResult.body);

    // Step 6: Test POST /api/books with non-existent author
    const invalidAuthorResult = await makeRequest('POST', '/api/books', {
        title: 'Test Book',
        published_year: 2020,
        author_id: 999999
    }, { Authorization: `Bearer ${accessToken}` });
    console.log('POST /api/books (non-existent author):', invalidAuthorResult.statusCode, invalidAuthorResult.body);

    // Step 7: Test POST /api/books with fully valid data
    const validBookResult = await makeRequest('POST', '/api/books', {
        title: 'Real Book To Delete',
        published_year: 2000,
        author_id: 1
    }, { Authorization: `Bearer ${accessToken}` });
    console.log('POST /api/books (valid):', validBookResult.statusCode, validBookResult.body);

    const adminDeleteBookId = validBookResult.body.id;

    // Step 8: Test DELETE /api/books/:id as admin using dynamically created book ID
    const deleteAsAdmin = await makeRequest('DELETE', `/api/books/${adminDeleteBookId}`, null, {
        Authorization: `Bearer ${accessToken}`
    });
    console.log('DELETE /api/books/:id as admin:', deleteAsAdmin.statusCode, deleteAsAdmin.body);

    // Step 8.5: Create a new test user to guarantee correct credentials
    const testUser = {
        username: `user_${Date.now()}`,
        password: 'userPass123'
    };
    await makeRequest('POST', '/api/register', testUser);

    // Step 9: Login as regular user
    const loginUserResult = await makeRequest('POST', '/api/login', testUser);
    console.log('POST /api/login (regular user):', loginUserResult.statusCode, loginUserResult.body);

    if (!loginUserResult.body || !loginUserResult.body.accessToken) {
        throw new Error('Login failed for regular user, no accessToken returned');
    }

    const userAccessToken = loginUserResult.body.accessToken;

    // Create another book as Admin so regular user has an existing book to attempt deleting
    const bookForUserTest = await makeRequest('POST', '/api/books', {
        title: 'Book Protected From User',
        published_year: 2021,
        author_id: 1
    }, { Authorization: `Bearer ${accessToken}` });

    const userDeleteBookId = bookForUserTest.body.id;

    // Step 10: Test DELETE /api/books/:id as regular user (Expect 403 Forbidden)
    const deleteAsUser = await makeRequest('DELETE', `/api/books/${userDeleteBookId}`, null, {
        Authorization: `Bearer ${userAccessToken}`
    });
    console.log('DELETE /api/books/:id as regular user (expect 403):', deleteAsUser.statusCode, deleteAsUser.body);

    // Step 11: Test POST /api/books with XSS title (Expect escaped output)

   const xssTestResult = await makeRequest('POST', '/api/books', {
    title: '<script>alert("hacked")</script>',
    published_year: 2020,
    author_id: 1
}, { Authorization: `Bearer ${accessToken}` });
console.log('POST /api/books (XSS title):', xssTestResult.statusCode, xssTestResult.body);


}


runTests().catch(err => {
    console.error('Test script failed:', err);
});


