const synthTest = !process.env.HOSTNAME;

const assert = require('assert');
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

describe('Advanced Security', () => {
	let cam = null;
	before((done) => {
		cam = new onvif.Cam(options, done);
	});

	describe('hasAdvancedSecurity', () => {
		it('should report that the service is supported', (done) => {
			cam.hasAdvancedSecurity((err, supported) => {
				assert.strictEqual(err, null);
				assert.strictEqual(supported, true);
				done();
			});
		});
	});

	if (!synthTest) {
		return;
	}

	describe('getAdvancedSecurityCapabilities', () => {
		it('should return the keystore capabilities', (done) => {
			cam.getAdvancedSecurityCapabilities((err, caps) => {
				assert.strictEqual(err, null);
				assert.strictEqual(caps.keystoreCapabilities.$.PKCS10ExternalCertificationWithRSA, true);
				assert.strictEqual(caps.keystoreCapabilities.$.RSAKeyLengths, '2048 3072 4096');
				assert.strictEqual(caps.TLSServerCapabilities.$.TLSClientAuthSupported, true);
				done();
			});
		});
	});

	describe('getAllCertificates', () => {
		it('should return every certificate, with its details', (done) => {
			cam.getAllCertificates((err, certs) => {
				assert.strictEqual(err, null);
				assert.strictEqual(certs.length, 2);

				const [client, ca] = certs;
				assert.strictEqual(client.certificateID, '1');
				assert.strictEqual(client.keyID, 'KEY-1');
				assert.strictEqual(client.alias, 'mqtt-client');
				assert.strictEqual(client.hasPrivateKey, true);
				assert.ok(client.certificateContent.length > 100);
				assert.strictEqual(client.x509.subject, 'CN=cam1.local');
				assert.strictEqual(client.x509.issuer, 'CN=Test MQTT CA');
				assert.strictEqual(client.x509.subjectAltName, 'DNS:cam1.local');
				assert.strictEqual(client.x509.ca, false);
				assert.ok(client.x509.validTo instanceof Date);
				assert.ok(client.x509.validTo > client.x509.validFrom);
				assert.match(client.x509.fingerprint256, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);

				assert.strictEqual(ca.certificateID, 'CA-1');
				assert.strictEqual(ca.alias, undefined);
				assert.strictEqual(ca.hasPrivateKey, undefined);
				assert.strictEqual(ca.x509.subject, 'CN=Test MQTT CA');
				assert.strictEqual(ca.x509.ca, true);
				done();
			});
		});
	});

	describe('getCertificate', () => {
		it('should return a certificate', (done) => {
			cam.getCertificate('1', (err, cert) => {
				assert.strictEqual(err, null);
				assert.strictEqual(cert.certificateID, '1');
				assert.strictEqual(cert.x509.subject, 'CN=cam1.local');
				done();
			});
		});
	});

	describe('getAllKeys', () => {
		it('should return an array, even for one key, with the IDs and aliases as strings', (done) => {
			cam.getAllKeys((err, keys) => {
				assert.strictEqual(err, null);
				assert.deepStrictEqual(keys, [{
					keyID: 'KEY-1',
					alias: '42',
					hasPrivateKey: true,
					keyStatus: 'ok',
					externallyGenerated: false,
					securelyStored: true,
				}]);
				done();
			});
		});
	});

	describe('certification paths', () => {
		it('getAllCertificationPaths should return the IDs', (done) => {
			cam.getAllCertificationPaths((err, ids) => {
				assert.strictEqual(err, null);
				assert.deepStrictEqual(ids, ['7']);
				done();
			});
		});
		it('getCertificationPath should return the certificate IDs in the path', (done) => {
			cam.getCertificationPath('7', (err, path) => {
				assert.strictEqual(err, null);
				assert.deepStrictEqual(path, { certificateID: ['1', 'CA-1'], alias: 'mqtt-client-path' });
				done();
			});
		});
	});

	describe('getAllCertPathValidationPolicies', () => {
		it('should return the policies and their trust anchors', (done) => {
			cam.getAllCertPathValidationPolicies((err, policies) => {
				assert.strictEqual(err, null);
				assert.strictEqual(policies.length, 1);
				assert.strictEqual(policies[0].certPathValidationPolicyID, '3');
				assert.strictEqual(policies[0].alias, 'mqtt-broker');
				assert.deepStrictEqual(policies[0].trustAnchor, [{ certificateID: 'CA-1' }]);
				done();
			});
		});
	});

	describe('the service address', () => {
		it('should be found with GetServices when the camera was set up from GetCapabilities', (done) => {
			const camera = new onvif.Cam({ ...options, autoconnect: false, media: 'ver10' });
			camera.getCapabilities((err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(camera.uri.advancedsecurity, undefined);
				camera.getAllCertificates((err, certs) => {
					assert.strictEqual(err, null);
					assert.strictEqual(certs.length, 2);
					assert.ok(camera.uri.advancedsecurity);
					done();
				});
			});
		});

		it('should give an error if the device does not have the service', (done) => {
			const camera = new onvif.Cam({ ...options, autoconnect: false });
			camera.services = [{ namespace: 'http://www.onvif.org/ver10/device/wsdl', XAddr: 'http://localhost/onvif/device_service' }];
			camera.hasAdvancedSecurity((err, supported) => {
				assert.strictEqual(err, null);
				assert.strictEqual(supported, false);
				camera.getAllCertificates((err, certs) => {
					assert.strictEqual(err.message, 'The device does not support the Advanced Security service');
					assert.strictEqual(certs, null);
					done();
				});
			});
		});
	});

	describe('promises', () => {
		it('should work through the promise wrapper', async() => {
			const camera = new CamPromise(options);
			const certs = await camera.getAllCertificates();
			assert.deepStrictEqual(certs.map((c) => c.x509.subject), ['CN=cam1.local', 'CN=Test MQTT CA']);
		});
	});
});
