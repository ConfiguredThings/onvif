const synthTest = !process.env.HOSTNAME;

const assert = require('assert');
const fs = require('fs');
const onvif = require('../lib/onvif');
const { Cam: CamPromise } = require('../promises/cam');
if (synthTest) {
	require('../test/serverMockup');
}

const options = {
	hostname: process.env.HOSTNAME || 'localhost',
	username: process.env.USERNAME || 'admin',
	password: process.env.PASSWORD || '9999',
	port: process.env.PORT ? parseInt(process.env.PORT) : 10101,
};

const DEVICE = 'xmlns="http://www.onvif.org/ver10/device/wsdl"';
const TT = 'xmlns="http://www.onvif.org/ver10/schema"';

// The test CA certificate, as base64 DER and as PEM
const caBase64 = fs.readFileSync(__dirname + '/serverMockup/advancedsecurity.GetAllCertificates.xml', 'utf8')
	.match(/<tas:CertificateContent>([^<]+)<\/tas:CertificateContent>\s*<\/tas:Certificate>\s*<\/tas:GetAll/)[1].trim();
const caPEM = '-----BEGIN CERTIFICATE-----\n' + caBase64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';

describe('Device certificates', () => {
	if (!synthTest) {
		return;
	}

	let cam = null;
	let bodies = [];
	before((done) => {
		cam = new onvif.Cam(options, (err) => {
			// Record each request's body, then send it as usual
			const request = cam._request;
			cam._request = function(options, callback) {
				bodies.push(options.body);
				return request.call(this, options, callback);
			};
			done(err);
		});
	});
	beforeEach(() => {
		bodies = [];
	});
	const lastBody = () => bodies[bodies.length - 1].replace(/^.*<s:Body[^>]*>|<\/s:Body>.*$/g, '');

	describe('getCertificates', () => {
		it('should return the certificates, with their details and IDs exactly as sent', (done) => {
			cam.getCertificates((err, certs) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<GetCertificates ${DEVICE}/>`);
				assert.strictEqual(certs.length, 2);
				assert.strictEqual(certs[0].certificateID, ' Camera 01 ');
				assert.strictEqual(certs[0].x509.subject, 'CN=cam1.local');
				assert.ok(certs[0].certificateContent.length > 100);
				assert.strictEqual(certs[1].certificateID, 'CACert313');
				assert.strictEqual(certs[1].x509.ca, true);
				done();
			});
		});
	});

	describe('getCACertificates', () => {
		it('should return an array, even for one certificate', (done) => {
			cam.getCACertificates((err, certs) => {
				assert.strictEqual(err, null);
				assert.strictEqual(certs.length, 1);
				assert.strictEqual(certs[0].certificateID, 'Test MQTT CA');
				assert.strictEqual(certs[0].certificateContent, caBase64);
				assert.strictEqual(certs[0].x509.subject, 'CN=Test MQTT CA');
				done();
			});
		});
	});

	describe('getCertificatesStatus / setCertificatesStatus', () => {
		it('should return each certificate\'s status, with the IDs as strings', (done) => {
			cam.getCertificatesStatus((err, statuses) => {
				assert.strictEqual(err, null);
				assert.deepStrictEqual(statuses, [
					{ certificateID: 'default', status: true },
					{ certificateID: '42', status: false },
				]);
				done();
			});
		});
		it('should send the statuses in the schema namespace', (done) => {
			cam.setCertificatesStatus([{ certificateID: 'https-1', status: true }, { certificateID: 'a&b', status: false }], (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<SetCertificatesStatus ${DEVICE}>` +
					`<CertificateStatus><CertificateID ${TT}>https-1</CertificateID><Status ${TT}>true</Status></CertificateStatus>` +
					`<CertificateStatus><CertificateID ${TT}>a&amp;b</CertificateID><Status ${TT}>false</Status></CertificateStatus>` +
					'</SetCertificatesStatus>');
				done();
			});
		});
		it('should give an error, without sending anything, for a status that is not a boolean', (done) => {
			cam.setCertificatesStatus({ certificateID: 'x', status: 'true' }, (err) => {
				assert.match(err.message, /boolean status/);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});

	describe('client certificate mode', () => {
		it('getClientCertificateMode should return a boolean', (done) => {
			cam.getClientCertificateMode((err, enabled) => {
				assert.strictEqual(err, null);
				assert.strictEqual(enabled, false);
				done();
			});
		});
		it('setClientCertificateMode should send Enabled', (done) => {
			cam.setClientCertificateMode(true, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<SetClientCertificateMode ${DEVICE}><Enabled>true</Enabled></SetClientCertificateMode>`);
				done();
			});
		});
		it('setClientCertificateMode should give an error for a value that is not a boolean', (done) => {
			cam.setClientCertificateMode('yes', (err) => {
				assert.ok(err instanceof Error);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});

	describe('createCertificate', () => {
		it('should send only what it is given, and return the new certificate', (done) => {
			cam.createCertificate({ subject: 'CN=cam1.local', validNotAfter: new Date('2030-01-01T00:00:00Z') }, (err, cert) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<CreateCertificate ${DEVICE}><Subject>CN=cam1.local</Subject>` +
					'<ValidNotAfter>2030-01-01T00:00:00.000Z</ValidNotAfter></CreateCertificate>');
				assert.strictEqual(cert.certificateID, 'https-1');
				assert.strictEqual(cert.x509.subject, 'CN=cam1.local');
				done();
			});
		});
		it('should take just a callback', (done) => {
			cam.createCertificate((err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<CreateCertificate ${DEVICE}></CreateCertificate>`);
				done();
			});
		});
	});

	describe('getPkcs10Request', () => {
		it('should send the certificate ID and subject and return the CSR', (done) => {
			cam.getPkcs10Request({ certificateID: 'https-1', subject: 'CN=cam1.local' }, (err, csr) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<GetPkcs10Request ${DEVICE}><CertificateID>https-1</CertificateID>` +
					'<Subject>CN=cam1.local</Subject></GetPkcs10Request>');
				assert.strictEqual(csr, 'TUlJQ1Rlc3RDU1I=');
				done();
			});
		});
		it('should give an error without a certificate ID', (done) => {
			cam.getPkcs10Request({}, (err) => {
				assert.ok(err instanceof Error);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});

	describe('loading certificates', () => {
		it('loadCACertificates should send PEM as base64 DER, in the schema namespace', (done) => {
			cam.loadCACertificates({ certificateID: 'mqtt-ca', certificate: caPEM }, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<LoadCACertificates ${DEVICE}><CACertificate>` +
					`<CertificateID ${TT}>mqtt-ca</CertificateID>` +
					`<Certificate ${TT}><Data>${caBase64}</Data></Certificate>` +
					'</CACertificate></LoadCACertificates>');
				done();
			});
		});
		it('loadCertificates should send each certificate as NVTCertificate, taking a DER Buffer', (done) => {
			cam.loadCertificates([
				{ certificateID: 'a', certificate: Buffer.from(caBase64, 'base64') },
				{ certificateID: 'b', certificate: Buffer.from(caPEM) },
			], (err) => {
				assert.strictEqual(err, null);
				const cert = (id) => `<NVTCertificate><CertificateID ${TT}>${id}</CertificateID>` +
					`<Certificate ${TT}><Data>${caBase64}</Data></Certificate></NVTCertificate>`;
				assert.strictEqual(lastBody(), `<LoadCertificates ${DEVICE}>${cert('a')}${cert('b')}</LoadCertificates>`);
				done();
			});
		});
		it('loadCertificateWithPrivateKey should send the certificate and key, the ID being optional', (done) => {
			const key = '-----BEGIN PRIVATE KEY-----\nS0VZ\n-----END PRIVATE KEY-----\n';
			cam.loadCertificateWithPrivateKey({ certificate: caBase64, privateKey: key }, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<LoadCertificateWithPrivateKey ${DEVICE}><CertificateWithPrivateKey>` +
					`<Certificate ${TT}><Data>${caBase64}</Data></Certificate>` +
					`<PrivateKey ${TT}><Data>S0VZ</Data></PrivateKey>` +
					'</CertificateWithPrivateKey></LoadCertificateWithPrivateKey>');
				done();
			});
		});
		it('should give an error for PEM with more than one certificate', (done) => {
			cam.loadCACertificates({ certificateID: 'bundle', certificate: caPEM + caPEM }, (err) => {
				assert.match(err.message, /one PEM block, found 2/);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
		it('should give an error for a certificate without an ID', (done) => {
			cam.loadCACertificates([{ certificate: caPEM }], (err) => {
				assert.match(err.message, /certificateID/);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});

	describe('getCertificateInformation', () => {
		it('should return the device\'s description of the certificate', (done) => {
			cam.getCertificateInformation('1', (err, info) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<GetCertificateInformation ${DEVICE}><CertificateID>1</CertificateID></GetCertificateInformation>`);
				assert.strictEqual(info.certificateID, '1');
				assert.strictEqual(info.subjectDN, 'CN=cam1.local');
				assert.strictEqual(info.keyLength, 2048);
				assert.ok(info.validity.until instanceof Date);
				done();
			});
		});
	});

	describe('deleteCertificates', () => {
		it('should send each ID, escaped', (done) => {
			cam.deleteCertificates(['a', ' Camera 01 ', 'x<y'], (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), `<DeleteCertificates ${DEVICE}><CertificateID>a</CertificateID>` +
					'<CertificateID> Camera 01 </CertificateID><CertificateID>x&lt;y</CertificateID></DeleteCertificates>');
				done();
			});
		});
		it('should give an error with no IDs', (done) => {
			cam.deleteCertificates([], (err) => {
				assert.ok(err instanceof Error);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});

	describe('promises', () => {
		it('should work through the promise wrapper', async() => {
			const camera = new CamPromise(options);
			const certs = await camera.getCACertificates();
			assert.strictEqual(certs[0].x509.subject, 'CN=Test MQTT CA');
			await assert.rejects(camera.deleteCertificates([]), /needs certificateIDs/);
		});
	});
});
