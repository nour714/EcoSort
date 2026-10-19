const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEnvironment(mockFetch) {
    const sandbox = {
        fetch: mockFetch,
        window: {
            ECOSORT_API_URL: '/predict'
        },
        document: {
            createElement: () => ({
                getContext: () => ({ drawImage: () => {} }),
                toBlob: (cb) => cb(new Uint8Array([1, 2, 3]))
            })
        },
        console: console,
        FormData: class {
            constructor() { this.entries = []; }
            append(k, v) { this.entries.push([k, v]); }
        },
        Blob: class {
            constructor(parts, opts) {
                this.size = (parts && parts[0] && parts[0].length) || 100;
                this.type = (opts && opts.type) || 'image/jpeg';
            }
        },
        File: class {
            constructor(parts, name, opts) {
                this.size = (parts && parts[0] && parts[0].length) || 100;
                this.name = name;
                this.type = (opts && opts.type) || 'image/jpeg';
            }
        }
    };
    sandbox.window = sandbox;

    const wasteDbCode = fs.readFileSync(path.join(__dirname, '../static/js/data/waste-database.js'), 'utf8');
    vm.runInNewContext(wasteDbCode, sandbox);

    const visionModCode = fs.readFileSync(path.join(__dirname, '../static/js/modules/vision-module.js'), 'utf8');
    vm.runInNewContext(visionModCode, sandbox);

    return sandbox;
}

test('P2-1: classifyWithBackend downscales files exceeding 3 MB', async () => {
    let requestedBlobSize = 0;
    const mockFetch = async (url, opts) => {
        requestedBlobSize = opts.body.entries[0][1].size;
        return {
            ok: true,
            status: 200,
            json: async () => ({
                status: 'success',
                class_name: 'plastic',
                material: 'Plastic',
                confidence: 90,
                top_k: []
            })
        };
    };

    const { VisionModule, Blob } = loadEnvironment(mockFetch);
    const vmInstance = new VisionModule();

    let downscaleCalled = false;
    vmInstance.downscaleImage = async (file) => {
        downscaleCalled = true;
        return new Blob([new Uint8Array(500 * 1024)]); // Reduced to 500KB
    };

    // A fake 5 MB file (> 3 MB)
    const largeFile = new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'image/jpeg' });
    const res = await vmInstance.classifyWithBackend(largeFile);

    assert.ok(downscaleCalled, 'downscaleImage must be called for file > 3 MB');
    assert.equal(requestedBlobSize, 500 * 1024, 'Uploaded file must be the downscaled file');
    assert.ok(res.item);
});

test('P2-1: classifyWithBackend handles HTTP 413 and non-JSON error pages gracefully', async () => {
    // Mock fetch returning HTML 413 Payload Too Large (common Nginx/Vercel error)
    const mockFetch413 = async () => ({
        ok: false,
        status: 413,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
        text: async () => '<html><body>413 Request Entity Too Large</body></html>'
    });

    const { VisionModule, Blob } = loadEnvironment(mockFetch413);
    const vmInstance = new VisionModule();

    const smallFile = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    await assert.rejects(
        async () => {
            await vmInstance.classifyWithBackend(smallFile);
        },
        (err) => {
            assert.match(err.message, /4 ميجابايت/);
            return true;
        }
    );
});
