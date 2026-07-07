const http = require('http');

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;

        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
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
    // Step 1: Create a book specifically to delete
    const created = await makeRequest('POST', '/api/books', {
        title: 'Temporary Book For Delete Test',
        published_year: 2020,
        author_id: 1
    });
    console.log('Created book:', created.statusCode, created.body);

    const idToDelete = created.body.id;

    // Step 2: Delete it — should succeed
    const deleteResult1 = await makeRequest('DELETE', `/api/books/${idToDelete}`);
    console.log(`DELETE /api/books/${idToDelete} (first time):`, deleteResult1.statusCode);

    // Step 3: Delete it again — should now be 404
    const deleteResult2 = await makeRequest('DELETE', `/api/books/${idToDelete}`);
    console.log(`DELETE /api/books/${idToDelete} (second time):`, deleteResult2.statusCode, deleteResult2.body);

    const booksResult = await makeRequest('GET', '/api/books');
console.log('GET /api/books:', booksResult.statusCode, booksResult.body);

}

runTests();


