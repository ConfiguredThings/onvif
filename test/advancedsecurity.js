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

describe('Advanced Security changes', () => {
	if (!synthTest) {
		return;
	}

	const TAS = 'xmlns="http://www.onvif.org/ver10/advancedsecurity/wsdl"';
	const caBase64 = require('fs').readFileSync(__dirname + '/serverMockup/advancedsecurity.GetAllCertificates.xml', 'utf8')
		.match(/<tas:CertificateContent>([^<]+)<\/tas:CertificateContent>\s*<\/tas:Certificate>\s*<\/tas:GetAll/)[1].trim();

	let cam = null;
	let bodies = [];
	before((done) => {
		cam = new onvif.Cam(options, (err) => {
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

	// Check a call sends `body` and returns `expected`
	const check = (method, args, body, expected) => (done) => {
		cam[method](...args, (err, result) => {
			assert.strictEqual(err, null);
			assert.strictEqual(lastBody(), body);
			assert.deepStrictEqual(result, expected);
			done();
		});
	};
	// Check a call gives an error without sending anything
	const rejects = (method, args, message) => (done) => {
		cam[method](...args, (err, result) => {
			assert.match(err.message, message);
			assert.strictEqual(result, null);
			assert.strictEqual(bodies.length, 0);
			done();
		});
	};

	describe('keys', () => {
		it('createRSAKeyPair should send the length and alias and return the key ID', check('createRSAKeyPair',
			[{ keyLength: 2048, alias: 'https' }],
			`<CreateRSAKeyPair ${TAS}><KeyLength>2048</KeyLength><Alias>https</Alias></CreateRSAKeyPair>`,
			{ keyID: 'KEY-3', estimatedCreationTime: 'PT5S' }));
		it('createRSAKeyPair should need a key length', rejects('createRSAKeyPair', [{}], /keyLength/));
		it('createECCKeyPair should send the curve', check('createECCKeyPair',
			[{ ellipticCurve: 'secp384r1' }],
			`<CreateECCKeyPair ${TAS}><EllipticCurve>secp384r1</EllipticCurve></CreateECCKeyPair>`,
			{ keyID: 'KEY-4', estimatedCreationTime: 'PT1S' }));
		it('getKeyStatus should return the status', check('getKeyStatus', ['KEY-3'],
			`<GetKeyStatus ${TAS}><KeyID>KEY-3</KeyID></GetKeyStatus>`, 'generating'));
		it('deleteKey should send the ID', check('deleteKey', ['KEY-3'],
			`<DeleteKey ${TAS}><KeyID>KEY-3</KeyID></DeleteKey>`, null));
		it('deleteKey should need an ID', rejects('deleteKey', [''], /KeyID/));
	});

	describe('certificates', () => {
		it('createPKCS10CSR should send the subject in the schema\'s order and sha256WithRSAEncryption by default',
			check('createPKCS10CSR',
				[{ keyID: 'KEY-3', subject: { commonName: 'cam1.local', organizationalUnit: ['Cameras', 'Site A'], country: 'GB' } }],
				`<CreatePKCS10CSR ${TAS}><Subject><Country>GB</Country><OrganizationalUnit>Cameras</OrganizationalUnit>` +
					'<OrganizationalUnit>Site A</OrganizationalUnit><CommonName>cam1.local</CommonName></Subject>' +
					'<KeyID>KEY-3</KeyID><SignatureAlgorithm><algorithm>1.2.840.113549.1.1.11</algorithm></SignatureAlgorithm>' +
					'</CreatePKCS10CSR>',
				'TUlJQ1Rlc3RDU1I='));
		it('createPKCS10CSR should take a signature algorithm by name', (done) => {
			cam.createPKCS10CSR({ keyID: 'KEY-4', subject: { commonName: 'c' }, signatureAlgorithm: 'ecdsa-with-SHA384' }, (err) => {
				assert.strictEqual(err, null);
				assert.ok(lastBody().includes('<algorithm>1.2.840.10045.4.3.3</algorithm>'));
				done();
			});
		});
		it('createPKCS10CSR should need a subject', rejects('createPKCS10CSR', [{ keyID: 'KEY-3', subject: {} }], /subject/));
		it('createSelfSignedCertificate should send its options in the schema\'s order', check('createSelfSignedCertificate',
			[{ keyID: 'KEY-3', subject: { commonName: 'cam1' }, alias: 'https', notValidAfter: new Date('2030-01-01T00:00:00Z') }],
			`<CreateSelfSignedCertificate ${TAS}><Subject><CommonName>cam1</CommonName></Subject><KeyID>KEY-3</KeyID>` +
				'<Alias>https</Alias><notValidAfter>2030-01-01T00:00:00.000Z</notValidAfter>' +
				'<SignatureAlgorithm><algorithm>1.2.840.113549.1.1.11</algorithm></SignatureAlgorithm>' +
				'</CreateSelfSignedCertificate>',
			'5'));
		it('uploadCertificate should send PEM as base64 DER', check('uploadCertificate',
			[{ certificate: '-----BEGIN CERTIFICATE-----\n' + caBase64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----', alias: 'mqtt-ca' }],
			`<UploadCertificate ${TAS}><Certificate>${caBase64}</Certificate><Alias>mqtt-ca</Alias></UploadCertificate>`,
			{ certificateID: 'CA-2', keyID: 'KEY-5' }));
		it('uploadCertificate should need a certificate', rejects('uploadCertificate', [{}], /certificate/));
		it('uploadCertificateWithPrivateKeyInPKCS12 should send the file as base64', check('uploadCertificateWithPrivateKeyInPKCS12',
			[{ pkcs12: Buffer.from([1, 2, 3]), passphrase: 'p&ss', keyAlias: 'mqtt' }],
			`<UploadCertificateWithPrivateKeyInPKCS12 ${TAS}><CertWithPrivateKey>AQID</CertWithPrivateKey>` +
				'<KeyAlias>mqtt</KeyAlias><Passphrase>p&amp;ss</Passphrase></UploadCertificateWithPrivateKeyInPKCS12>',
			{ certificationPathID: '8', keyID: 'KEY-6' }));
		it('deleteCertificate should send the ID', check('deleteCertificate', ['CA-2'],
			`<DeleteCertificate ${TAS}><CertificateID>CA-2</CertificateID></DeleteCertificate>`, null));
	});

	describe('certification paths', () => {
		it('createCertificationPath should send the certificate IDs', check('createCertificationPath',
			[{ certificateIDs: ['1', 'CA-1'], alias: 'mqtt-client' }],
			`<CreateCertificationPath ${TAS}><CertificateIDs><CertificateID>1</CertificateID><CertificateID>CA-1</CertificateID>` +
				'</CertificateIDs><Alias>mqtt-client</Alias></CreateCertificationPath>',
			'9'));
		it('createCertificationPath should need certificate IDs', rejects('createCertificationPath', [{ certificateIDs: [] }], /certificateIDs/));
		it('deleteCertificationPath should send the ID', check('deleteCertificationPath', ['9'],
			`<DeleteCertificationPath ${TAS}><CertificationPathID>9</CertificationPathID></DeleteCertificationPath>`, null));
	});

	describe('certification path validation policies', () => {
		it('createCertPathValidationPolicy should send the trust anchors, with Parameters', check('createCertPathValidationPolicy',
			[{ trustAnchors: ['CA-1', 'CA-2'], alias: 'mqtt-broker' }],
			`<CreateCertPathValidationPolicy ${TAS}><Alias>mqtt-broker</Alias><Parameters></Parameters>` +
				'<TrustAnchor><CertificateID>CA-1</CertificateID></TrustAnchor>' +
				'<TrustAnchor><CertificateID>CA-2</CertificateID></TrustAnchor></CreateCertPathValidationPolicy>',
			'4'));
		it('createCertPathValidationPolicy should take one trust anchor and the parameters', (done) => {
			cam.createCertPathValidationPolicy({ trustAnchors: 'CA-1', useDeltaCRLs: false }, (err) => {
				assert.strictEqual(err, null);
				assert.ok(lastBody().includes('<Parameters><UseDeltaCRLs>false</UseDeltaCRLs></Parameters>' +
					'<TrustAnchor><CertificateID>CA-1</CertificateID></TrustAnchor>'));
				done();
			});
		});
		it('createCertPathValidationPolicy should need a trust anchor',
			rejects('createCertPathValidationPolicy', [{ trustAnchors: [] }], /trustAnchors/));
		it('getCertPathValidationPolicy should return the policy', check('getCertPathValidationPolicy', ['3'],
			`<GetCertPathValidationPolicy ${TAS}><CertPathValidationPolicyID>3</CertPathValidationPolicyID></GetCertPathValidationPolicy>`,
			{ certPathValidationPolicyID: '3', alias: 'mqtt-broker', parameters: '', trustAnchor: [{ certificateID: 'CA-1' }] }));
		it('deleteCertPathValidationPolicy should send the ID', check('deleteCertPathValidationPolicy', ['3'],
			`<DeleteCertPathValidationPolicy ${TAS}><CertPathValidationPolicyID>3</CertPathValidationPolicyID></DeleteCertPathValidationPolicy>`,
			null));
	});

	describe('TLS server', () => {
		it('getAssignedServerCertificates should return an array of IDs', check('getAssignedServerCertificates', [],
			`<GetAssignedServerCertificates ${TAS}/>`, ['7']));
		it('addServerCertificateAssignment should send the path', check('addServerCertificateAssignment', ['9'],
			`<AddServerCertificateAssignment ${TAS}><CertificationPathID>9</CertificationPathID></AddServerCertificateAssignment>`, null));
		it('removeServerCertificateAssignment should send the path', check('removeServerCertificateAssignment', ['7'],
			`<RemoveServerCertificateAssignment ${TAS}><CertificationPathID>7</CertificationPathID></RemoveServerCertificateAssignment>`, null));
		it('replaceServerCertificateAssignment should send both paths', check('replaceServerCertificateAssignment',
			[{ oldCertificationPathID: '7', newCertificationPathID: '9' }],
			`<ReplaceServerCertificateAssignment ${TAS}><OldCertificationPathID>7</OldCertificationPathID>` +
				'<NewCertificationPathID>9</NewCertificationPathID></ReplaceServerCertificateAssignment>', null));
		it('replaceServerCertificateAssignment should need both paths',
			rejects('replaceServerCertificateAssignment', [{ oldCertificationPathID: '7' }], /newCertificationPathID/));
	});

	describe('promises', () => {
		it('should reject for bad arguments', async() => {
			const camera = new CamPromise(options);
			assert.deepStrictEqual(await camera.createRSAKeyPair({ keyLength: 2048 }), { keyID: 'KEY-3', estimatedCreationTime: 'PT5S' });
			await assert.rejects(camera.createRSAKeyPair({}), /keyLength/);
		});
	});
});
