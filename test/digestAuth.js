const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const onvif = require('../lib/onvif');

// A device that only accepts HTTP Digest auth
const REALM = 'ONVIF';
const NONCE = 'dGVzdG5vbmNl';
const USERNAME = 'admin';
const PASSWORD = 's3cret!';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

const parseAuth = (header) => {
	const params = {};
	const re = /(\w+)="?([^",]*)"?/g;
	let m;
	while ((m = re.exec(header.slice(7))) !== null) {
		params[m[1]] = m[2];
	}
	return params;
};

const validDigest = (req) => {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Digest ')) {
		return false;
	}
	const p = parseAuth(header);
	const ha1 = md5(`${USERNAME}:${REALM}:${PASSWORD}`);
	const ha2 = md5(`${req.method}:${p.uri}`);
	return p.response === md5(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`);
};

const RESPONSE = '<?xml version="1.0" encoding="UTF-8"?>' +
	'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>' +
	'<tds:GetHostnameResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl">' +
	'<tds:HostnameInformation><tt:Name xmlns:tt="http://www.onvif.org/ver10/schema">cam</tt:Name></tds:HostnameInformation>' +
	'</tds:GetHostnameResponse></s:Body></s:Envelope>';

const BODY = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Header></s:Header>' +
	'<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
	'<GetHostname xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body></s:Envelope>';

describe('HTTP Digest auth', () => {
	let server;
	let port;
	let requests;

	before((done) => {
		server = http.createServer((req, res) => {
			req.resume();
			req.on('end', () => {
				requests += 1;
				if (validDigest(req)) {
					res.writeHead(200, {'Content-Type': 'application/soap+xml'});
					res.end(RESPONSE);
				} else {
					res.writeHead(401, {
						'Content-Type': 'text/plain',
						'WWW-Authenticate': `Digest realm="${REALM}", qop="auth", nonce="${NONCE}", algorithm=MD5`,
					});
					res.end('Unauthorized');
				}
			});
		});
		server.listen(0, () => {
			port = server.address().port;
			done();
		});
	});

	after((done) => {
		server.close(done);
	});

	beforeEach(() => {
		requests = 0;
	});

	// Make a request, and wait long enough after the first callback to see a second one
	const request = (password, done, check) => {
		const cam = new onvif.Cam({
			hostname: 'localhost',
			port,
			username: USERNAME,
			password,
			useWSSecurity: false,
			autoconnect: false,
		});
		const calls = [];
		cam._request({body: BODY}, (err, data) => {
			calls.push({err, data});
			if (calls.length === 1) {
				setTimeout(() => {
					try {
						check(calls);
						done();
					} catch (e) {
						done(e);
					}
				}, 200);
			}
		});
	};

	it('should return only the response to the retry with the right password', (done) => {
		request(PASSWORD, done, (calls) => {
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].err, null);
			assert.ok(calls[0].data[0].getHostnameResponse);
			assert.strictEqual(requests, 2);
		});
	});

	it('should retry once and return the 401 with the wrong password', (done) => {
		request('wrong', done, (calls) => {
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].err.message, 'HTTP Error 401 Unauthorized');
			assert.strictEqual(requests, 2);
		});
	});
});
