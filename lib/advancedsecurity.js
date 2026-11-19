/**
 * @namespace cam
 * @description Advanced Security service section for Cam class: the keystore (keys, certificates,
 * certification paths), certification path validation policies and the TLS server's certificates.
 * See https://www.onvif.org/specs/srv/security/ONVIF-Security-Service-Spec.pdf
 * @licence MIT
 */
module.exports = function(Cam) {

	const { linerase, escapeXml, toBase64DER, parseCertificate } = require('./utils');

	const NAMESPACE = 'http://www.onvif.org/ver10/advancedsecurity/wsdl';

	// linerase returns a single element as itself rather than an array, and
	// no elements as undefined
	function toArray(value) {
		if (value === undefined || value === null) {
			return [];
		}
		return Array.isArray(value) ? value : [value];
	}

	// linerase turns IDs and aliases that look like numbers into numbers
	function toStr(value) {
		return value === undefined || value === null ? value : String(value);
	}

	function hasValue(value) {
		return value !== undefined && value !== null && value !== '';
	}

	// An element with an escaped value, or nothing if there's no value
	function element(name, value) {
		return hasValue(value) ? `<${name}>${escapeXml(value)}</${name}>` : '';
	}

	// An xs:dateTime from a Date or a string
	function dateTime(value) {
		return value instanceof Date ? value.toISOString() : value;
	}

	// Call back with an error for bad arguments, without sending anything
	function invalid(callback, message) {
		const err = new Error(message);
		if (typeof callback === 'function') {
			return callback(err, null);
		}
		throw err;
	}

	// The order of tas:DistinguishedName's elements
	const DN_ELEMENTS = [
		['country', 'Country'],
		['stateOrProvinceName', 'StateOrProvinceName'],
		['locality', 'Locality'],
		['organization', 'Organization'],
		['organizationalUnit', 'OrganizationalUnit'],
		['commonName', 'CommonName'],
	];

	/**
	 * The subject of a CSR or self-signed certificate. Each value is a string, or an array for
	 * an attribute with more than one value. At least one is needed
	 * @typedef {object} Cam~DistinguishedName
	 * @property {string|Array<string>} [country] C, a two letter country code
	 * @property {string|Array<string>} [stateOrProvinceName] ST
	 * @property {string|Array<string>} [locality] L
	 * @property {string|Array<string>} [organization] O
	 * @property {string|Array<string>} [organizationalUnit] OU
	 * @property {string|Array<string>} [commonName] CN, e.g. the device's host name
	 */
	function distinguishedName(subject) {
		const content = DN_ELEMENTS.map(([key, name]) =>
			toArray(subject && subject[key]).map((v) => element(name, v)).join('')).join('');
		return content ? `<Subject>${content}</Subject>` : null;
	}

	// Signature algorithm OIDs, by name
	const SIGNATURE_ALGORITHMS = {
		sha256WithRSAEncryption: '1.2.840.113549.1.1.11',
		sha384WithRSAEncryption: '1.2.840.113549.1.1.12',
		sha512WithRSAEncryption: '1.2.840.113549.1.1.13',
		'ecdsa-with-SHA256': '1.2.840.10045.4.3.2',
		'ecdsa-with-SHA384': '1.2.840.10045.4.3.3',
		'ecdsa-with-SHA512': '1.2.840.10045.4.3.4',
	};

	// A tas:AlgorithmIdentifier, from a name in SIGNATURE_ALGORITHMS or an OID
	function signatureAlgorithm(value) {
		const oid = SIGNATURE_ALGORITHMS[value || 'sha256WithRSAEncryption'] || value;
		return `<SignatureAlgorithm><algorithm>${escapeXml(oid)}</algorithm></SignatureAlgorithm>`;
	}

	// For a request that only sends an ID and has an empty response
	function sendID(cam, operation, idName, id, callback) {
		if (!hasValue(id)) {
			return invalid(callback, `${operation} needs ${idName}`);
		}
		cam._advancedSecurityRequest(
			`<${operation}>${element(idName, id)}</${operation}>`, () => null, callback);
	}

	/**
	 * @typedef {object} Cam~X509Certificate
	 * @property {string} certificateID ID of the certificate in the keystore, e.g. for AddEventBroker's CertificateID
	 * @property {string} keyID ID of the certificate's public key in the keystore
	 * @property {string} [alias]
	 * @property {string} certificateContent The certificate, as base64 DER
	 * @property {boolean} [hasPrivateKey] If the device holds the certificate's private key (not all devices report it)
	 * @property {object} [x509] The certificate's details, if it could be parsed: subject, issuer, subjectAltName,
	 * serialNumber, validFrom, validTo (Dates), fingerprint256, ca
	 */
	function certificate(c) {
		return {
			...c,
			certificateID: toStr(c.certificateID),
			keyID: toStr(c.keyID),
			alias: toStr(c.alias),
			certificateContent: toStr(c.certificateContent),
			x509: parseCertificate(c.certificateContent),
		};
	}

	/**
	 * Send a request to the Advanced Security service. Its address comes from GetServices, which
	 * is called if it hasn't been already, as the service isn't in GetCapabilities. Returns an
	 * error if the device doesn't have the service
	 * @param {string} body The request, inside the SOAP body, without its namespace
	 * @param {function} parse Turns the linerased response into the result
	 * @param {function} callback
	 * @private
	 */
	Cam.prototype._advancedSecurityRequest = function(body, parse, callback) {
		const send = () => {
			this._request({
				service: 'advancedsecurity',
				body: this._envelopeHeader() +
					body.replace(/^<(\w+)/, `<$1 xmlns="${NAMESPACE}"`) +
					this._envelopeFooter(),
			}, (err, data, xml) => {
				let result = null;
				if (!err) {
					try {
						result = parse(linerase(data));
					} catch (e) {
						err = new Error('Wrong ONVIF response: ' + e.message);
					}
				}
				callback.call(this, err, result, xml);
			});
		};

		const useServices = (services) => {
			const service = toArray(services).find((s) => s && s.namespace === NAMESPACE && s.XAddr);
			if (!service) {
				return callback.call(this, new Error('The device does not support the Advanced Security service'), null);
			}
			this.uri = this.uri || {};
			this.uri.advancedsecurity = this._parseUrl(service.XAddr);
			send();
		};

		if (this.uri && this.uri.advancedsecurity) {
			return send();
		}
		if (this.services) {
			return useServices(this.services);
		}
		this.getServices(false, (err, services) => {
			if (err) {
				return callback.call(this, err, null);
			}
			useServices(services);
		});
	};

	/**
	 * @callback Cam~AdvancedSecurityCallback
	 * @property {?Error} error
	 * @property {*} result
	 * @property {string} xml Raw SOAP response
	 */

	/**
	 * Is the Advanced Security service supported, from GetServices (which is called if it hasn't been already)
	 * @param {function} callback (err, supported: boolean)
	 */
	Cam.prototype.hasAdvancedSecurity = function(callback) {
		const check = (services) => callback.call(this, null,
			toArray(services).some((s) => s && s.namespace === NAMESPACE));
		if (this.services) {
			return check(this.services);
		}
		this.getServices(false, (err, services) => {
			if (err) {
				return callback.call(this, err, null);
			}
			check(services);
		});
	};

	/**
	 * Get the capabilities of the Advanced Security service: keystoreCapabilities, TLSServerCapabilities, ...
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.getAdvancedSecurityCapabilities = function(callback) {
		this._advancedSecurityRequest('<GetServiceCapabilities/>',
			(data) => data.getServiceCapabilitiesResponse.capabilities, callback);
	};

	/**
	 * Get all the certificates in the keystore, including any loaded manually
	 * @param {Cam~AdvancedSecurityCallback} callback result is an Array of {@link Cam~X509Certificate}
	 */
	Cam.prototype.getAllCertificates = function(callback) {
		this._advancedSecurityRequest('<GetAllCertificates/>',
			(data) => toArray(data.getAllCertificatesResponse.certificate).map(certificate), callback);
	};

	/**
	 * Get a certificate from the keystore
	 * @param {string} certificateID
	 * @param {Cam~AdvancedSecurityCallback} callback result is a {@link Cam~X509Certificate}
	 */
	Cam.prototype.getCertificate = function(certificateID, callback) {
		this._advancedSecurityRequest(
			`<GetCertificate><CertificateID>${escapeXml(certificateID)}</CertificateID></GetCertificate>`,
			(data) => certificate(data.getCertificateResponse.certificate), callback);
	};

	/**
	 * @typedef {object} Cam~KeyAttribute
	 * @property {string} keyID
	 * @property {string} [alias]
	 * @property {boolean} [hasPrivateKey]
	 * @property {string} keyStatus 'ok', 'generating' or 'corrupt'
	 * @property {boolean} [externallyGenerated]
	 * @property {boolean} [securelyStored]
	 */

	/**
	 * Get all the keys in the keystore
	 * @param {Cam~AdvancedSecurityCallback} callback result is an Array of {@link Cam~KeyAttribute}
	 */
	Cam.prototype.getAllKeys = function(callback) {
		this._advancedSecurityRequest('<GetAllKeys/>',
			(data) => toArray(data.getAllKeysResponse.keyAttribute).map((k) => ({
				...k,
				keyID: toStr(k.keyID),
				alias: toStr(k.alias),
			})), callback);
	};

	/**
	 * Get the IDs of all the certification paths (chains of certificates) in the keystore
	 * @param {Cam~AdvancedSecurityCallback} callback result is an Array of IDs
	 */
	Cam.prototype.getAllCertificationPaths = function(callback) {
		this._advancedSecurityRequest('<GetAllCertificationPaths/>',
			(data) => toArray(data.getAllCertificationPathsResponse.certificationPathID).map(toStr), callback);
	};

	/**
	 * Get a certification path
	 * @param {string} certificationPathID
	 * @param {Cam~AdvancedSecurityCallback} callback result is {certificateID: Array of IDs, from the
	 * certificate to its CA, alias}
	 */
	Cam.prototype.getCertificationPath = function(certificationPathID, callback) {
		this._advancedSecurityRequest(
			'<GetCertificationPath><CertificationPathID>' + escapeXml(certificationPathID) +
				'</CertificationPathID></GetCertificationPath>',
			(data) => {
				const path = data.getCertificationPathResponse.certificationPath;
				return {
					...path,
					certificateID: toArray(path.certificateID).map(toStr),
					alias: toStr(path.alias),
				};
			}, callback);
	};

	/**
	 * Get all the certification path validation policies, which say which CAs (trust anchors) are trusted,
	 * e.g. for AddEventBroker's CertPathValidationPolicyID
	 * @param {Cam~AdvancedSecurityCallback} callback result is an Array of
	 * {certPathValidationPolicyID, alias, parameters, trustAnchor: Array of {certificateID}}
	 */
	Cam.prototype.getAllCertPathValidationPolicies = function(callback) {
		this._advancedSecurityRequest('<GetAllCertPathValidationPolicies/>',
			(data) => toArray(data.getAllCertPathValidationPoliciesResponse.certPathValidationPolicy).map(policy), callback);
	};

	function policy(p) {
		return {
			...p,
			certPathValidationPolicyID: toStr(p.certPathValidationPolicyID),
			alias: toStr(p.alias),
			trustAnchor: toArray(p.trustAnchor).map((t) => ({ ...t, certificateID: toStr(t.certificateID) })),
		};
	}

	//
	// Keys
	//

	/**
	 * @typedef {object} Cam~CreatedKey
	 * @property {string} keyID ID of the new key. Its status is `generating` until it is ready
	 * @property {string} [estimatedCreationTime] How long the device expects it to take, as an
	 * xs:duration, e.g. `PT5S`
	 */

	/**
	 * Have the device generate an RSA key pair. It is generated in the background: wait for
	 * getKeyStatus to return `ok` before using it, e.g. in createPKCS10CSR
	 * @param {object} options
	 * @param {number} options.keyLength In bits, one of the capabilities' RSAKeyLengths, e.g. 2048
	 * @param {string} [options.alias]
	 * @param {Cam~AdvancedSecurityCallback} callback result is a {@link Cam~CreatedKey}
	 */
	Cam.prototype.createRSAKeyPair = function(options, callback) {
		if (!options || !hasValue(options.keyLength)) {
			return invalid(callback, 'createRSAKeyPair needs keyLength');
		}
		this._advancedSecurityRequest(
			'<CreateRSAKeyPair>' + element('KeyLength', options.keyLength) + element('Alias', options.alias) +
				'</CreateRSAKeyPair>',
			(data) => createdKey(data.createRSAKeyPairResponse), callback);
	};

	/**
	 * Have the device generate an elliptic curve key pair. As with createRSAKeyPair, wait for
	 * getKeyStatus to return `ok` before using it
	 * @param {object} options
	 * @param {string} options.ellipticCurve One of the capabilities' EllipticCurves, e.g. `secp256r1`
	 * @param {string} [options.alias]
	 * @param {Cam~AdvancedSecurityCallback} callback result is a {@link Cam~CreatedKey}
	 */
	Cam.prototype.createECCKeyPair = function(options, callback) {
		if (!options || !hasValue(options.ellipticCurve)) {
			return invalid(callback, 'createECCKeyPair needs ellipticCurve');
		}
		this._advancedSecurityRequest(
			'<CreateECCKeyPair>' + element('EllipticCurve', options.ellipticCurve) + element('Alias', options.alias) +
				'</CreateECCKeyPair>',
			(data) => createdKey(data.createECCKeyPairResponse), callback);
	};

	function createdKey(response) {
		return {
			keyID: toStr(response.keyID),
			estimatedCreationTime: toStr(response.estimatedCreationTime),
		};
	}

	/**
	 * Get the status of a key
	 * @param {string} keyID
	 * @param {Cam~AdvancedSecurityCallback} callback result is `ok`, `generating` or `corrupt`
	 */
	Cam.prototype.getKeyStatus = function(keyID, callback) {
		if (!hasValue(keyID)) {
			return invalid(callback, 'getKeyStatus needs keyID');
		}
		this._advancedSecurityRequest(`<GetKeyStatus>${element('KeyID', keyID)}</GetKeyStatus>`,
			(data) => toStr(data.getKeyStatusResponse.keyStatus), callback);
	};

	/**
	 * Delete a key. The device refuses to delete a key a certificate uses
	 * @param {string} keyID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.deleteKey = function(keyID, callback) {
		sendID(this, 'DeleteKey', 'KeyID', keyID, callback);
	};

	//
	// Certificates
	//

	/**
	 * Have the device create a PKCS#10 certificate signing request for one of its keys, for a CA to
	 * sign. Upload the signed certificate with uploadCertificate
	 * @param {object} options
	 * @param {string} options.keyID The key to sign the request with, e.g. from createRSAKeyPair
	 * @param {Cam~DistinguishedName} options.subject
	 * @param {string} [options.signatureAlgorithm=sha256WithRSAEncryption] A name
	 * (sha256WithRSAEncryption, sha384WithRSAEncryption, sha512WithRSAEncryption, ecdsa-with-SHA256,
	 * ecdsa-with-SHA384, ecdsa-with-SHA512) or an OID. An ECC key needs an ecdsa one
	 * @param {Cam~AdvancedSecurityCallback} callback result is the CSR, as base64 DER
	 */
	Cam.prototype.createPKCS10CSR = function(options, callback) {
		const subject = distinguishedName(options && options.subject);
		if (!options || !hasValue(options.keyID) || !subject) {
			return invalid(callback, 'createPKCS10CSR needs keyID and subject');
		}
		this._advancedSecurityRequest(
			'<CreatePKCS10CSR>' + subject + element('KeyID', options.keyID) +
				signatureAlgorithm(options.signatureAlgorithm) + '</CreatePKCS10CSR>',
			(data) => toStr(data.createPKCS10CSRResponse.PKCS10CSR), callback);
	};

	/**
	 * Have the device create a self-signed certificate for one of its keys
	 * @param {object} options
	 * @param {string} options.keyID
	 * @param {Cam~DistinguishedName} options.subject
	 * @param {string} [options.alias]
	 * @param {Date|string} [options.notValidBefore]
	 * @param {Date|string} [options.notValidAfter]
	 * @param {string} [options.signatureAlgorithm=sha256WithRSAEncryption] As for createPKCS10CSR
	 * @param {Cam~AdvancedSecurityCallback} callback result is the new certificate's ID
	 */
	Cam.prototype.createSelfSignedCertificate = function(options, callback) {
		const subject = distinguishedName(options && options.subject);
		if (!options || !hasValue(options.keyID) || !subject) {
			return invalid(callback, 'createSelfSignedCertificate needs keyID and subject');
		}
		this._advancedSecurityRequest(
			'<CreateSelfSignedCertificate>' + subject + element('KeyID', options.keyID) +
				element('Alias', options.alias) +
				element('notValidBefore', dateTime(options.notValidBefore)) +
				element('notValidAfter', dateTime(options.notValidAfter)) +
				signatureAlgorithm(options.signatureAlgorithm) + '</CreateSelfSignedCertificate>',
			(data) => toStr(data.createSelfSignedCertificateResponse.certificateID), callback);
	};

	/**
	 * Upload a certificate: a CA's, e.g. for a certification path validation policy, or one signed
	 * from a createPKCS10CSR request. The device adds its public key to the keystore too, or uses the
	 * key it already has
	 * @param {object} options
	 * @param {string|Buffer} options.certificate PEM (one certificate), base64 DER or a DER Buffer
	 * @param {string} [options.alias]
	 * @param {string} [options.keyAlias] Alias for the key, if the device adds one
	 * @param {boolean} [options.privateKeyRequired] Fail unless the device has the certificate's private key
	 * @param {Cam~AdvancedSecurityCallback} callback result is {certificateID, keyID}
	 */
	Cam.prototype.uploadCertificate = function(options, callback) {
		let certificate;
		try {
			certificate = hasValue(options && options.certificate) ? toBase64DER(options.certificate) : null;
		} catch (e) {
			return invalid(callback, 'uploadCertificate: ' + e.message);
		}
		if (!certificate) {
			return invalid(callback, 'uploadCertificate needs a certificate');
		}
		this._advancedSecurityRequest(
			'<UploadCertificate>' + element('Certificate', certificate) + element('Alias', options.alias) +
				element('KeyAlias', options.keyAlias) + element('PrivateKeyRequired', options.privateKeyRequired) +
				'</UploadCertificate>',
			(data) => ({
				certificateID: toStr(data.uploadCertificateResponse.certificateID),
				keyID: toStr(data.uploadCertificateResponse.keyID),
			}), callback);
	};

	/**
	 * Upload a PKCS#12 file holding a certificate, its private key and optionally its CA
	 * certificates. The device creates a certification path from them
	 * @param {object} options
	 * @param {string|Buffer} options.pkcs12 The PKCS#12 file, as a Buffer or base64
	 * @param {string} [options.passphrase] The file's passphrase
	 * @param {string} [options.certificationPathAlias]
	 * @param {string} [options.keyAlias]
	 * @param {boolean} [options.ignoreAdditionalCertificates] Only use the certificate, not its CA certificates
	 * @param {Cam~AdvancedSecurityCallback} callback result is {certificationPathID, keyID}
	 */
	Cam.prototype.uploadCertificateWithPrivateKeyInPKCS12 = function(options, callback) {
		if (!options || !hasValue(options.pkcs12)) {
			return invalid(callback, 'uploadCertificateWithPrivateKeyInPKCS12 needs pkcs12');
		}
		let pkcs12;
		try {
			pkcs12 = toBase64DER(options.pkcs12);
		} catch (e) {
			return invalid(callback, 'uploadCertificateWithPrivateKeyInPKCS12: ' + e.message);
		}
		this._advancedSecurityRequest(
			'<UploadCertificateWithPrivateKeyInPKCS12>' +
				element('CertWithPrivateKey', pkcs12) +
				element('CertificationPathAlias', options.certificationPathAlias) +
				element('KeyAlias', options.keyAlias) +
				element('IgnoreAdditionalCertificates', options.ignoreAdditionalCertificates) +
				element('Passphrase', options.passphrase) +
				'</UploadCertificateWithPrivateKeyInPKCS12>',
			(data) => ({
				certificationPathID: toStr(data.uploadCertificateWithPrivateKeyInPKCS12Response.certificationPathID),
				keyID: toStr(data.uploadCertificateWithPrivateKeyInPKCS12Response.keyID),
			}), callback);
	};

	/**
	 * Delete a certificate. Its key is kept
	 * @param {string} certificateID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.deleteCertificate = function(certificateID, callback) {
		sendID(this, 'DeleteCertificate', 'CertificateID', certificateID, callback);
	};

	//
	// Certification paths
	//

	/**
	 * Create a certification path, e.g. for a server certificate assignment
	 * @param {object} options
	 * @param {Array<string>} options.certificateIDs The certificates, from the device's own to its root CA
	 * @param {string} [options.alias]
	 * @param {Cam~AdvancedSecurityCallback} callback result is the new path's ID
	 */
	Cam.prototype.createCertificationPath = function(options, callback) {
		const ids = toArray(options && options.certificateIDs).filter(hasValue);
		if (!ids.length) {
			return invalid(callback, 'createCertificationPath needs certificateIDs');
		}
		this._advancedSecurityRequest(
			'<CreateCertificationPath><CertificateIDs>' + ids.map((id) => element('CertificateID', id)).join('') +
				'</CertificateIDs>' + element('Alias', options.alias) + '</CreateCertificationPath>',
			(data) => toStr(data.createCertificationPathResponse.certificationPathID), callback);
	};

	/**
	 * Delete a certification path. Its certificates are kept
	 * @param {string} certificationPathID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.deleteCertificationPath = function(certificationPathID, callback) {
		sendID(this, 'DeleteCertificationPath', 'CertificationPathID', certificationPathID, callback);
	};

	//
	// Certification path validation policies
	//

	/**
	 * Create a certification path validation policy, which says which CAs to trust, e.g. for
	 * addEventBroker's certPathValidationPolicyID
	 * @param {object} options
	 * @param {Array<string>} options.trustAnchors IDs of the CA certificates to trust
	 * @param {string} [options.alias]
	 * @param {boolean} [options.requireTLSWWWClientAuthExtendedKeyUsage]
	 * @param {boolean} [options.useDeltaCRLs]
	 * @param {Cam~AdvancedSecurityCallback} callback result is the new policy's ID
	 */
	Cam.prototype.createCertPathValidationPolicy = function(options, callback) {
		const anchors = toArray(options && options.trustAnchors).filter(hasValue);
		if (!anchors.length) {
			return invalid(callback, 'createCertPathValidationPolicy needs trustAnchors');
		}
		this._advancedSecurityRequest(
			'<CreateCertPathValidationPolicy>' + element('Alias', options.alias) +
				'<Parameters>' +
				element('RequireTLSWWWClientAuthExtendedKeyUsage', options.requireTLSWWWClientAuthExtendedKeyUsage) +
				element('UseDeltaCRLs', options.useDeltaCRLs) +
				'</Parameters>' +
				anchors.map((id) => `<TrustAnchor>${element('CertificateID', id)}</TrustAnchor>`).join('') +
				'</CreateCertPathValidationPolicy>',
			(data) => toStr(data.createCertPathValidationPolicyResponse.certPathValidationPolicyID), callback);
	};

	/**
	 * Get a certification path validation policy
	 * @param {string} certPathValidationPolicyID
	 * @param {Cam~AdvancedSecurityCallback} callback result is as for getAllCertPathValidationPolicies
	 */
	Cam.prototype.getCertPathValidationPolicy = function(certPathValidationPolicyID, callback) {
		if (!hasValue(certPathValidationPolicyID)) {
			return invalid(callback, 'getCertPathValidationPolicy needs certPathValidationPolicyID');
		}
		this._advancedSecurityRequest(
			'<GetCertPathValidationPolicy>' + element('CertPathValidationPolicyID', certPathValidationPolicyID) +
				'</GetCertPathValidationPolicy>',
			(data) => policy(data.getCertPathValidationPolicyResponse.certPathValidationPolicy), callback);
	};

	/**
	 * Delete a certification path validation policy
	 * @param {string} certPathValidationPolicyID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.deleteCertPathValidationPolicy = function(certPathValidationPolicyID, callback) {
		sendID(this, 'DeleteCertPathValidationPolicy', 'CertPathValidationPolicyID', certPathValidationPolicyID, callback);
	};

	//
	// TLS server: which certification paths the device's HTTPS (and, on some devices, RTSPS) server uses
	//

	/**
	 * Get the certification paths assigned to the device's TLS server
	 * @param {Cam~AdvancedSecurityCallback} callback result is an Array of IDs
	 */
	Cam.prototype.getAssignedServerCertificates = function(callback) {
		this._advancedSecurityRequest('<GetAssignedServerCertificates/>',
			(data) => toArray(data.getAssignedServerCertificatesResponse.certificationPathID).map(toStr), callback);
	};

	/**
	 * Assign a certification path to the device's TLS server
	 * @param {string} certificationPathID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.addServerCertificateAssignment = function(certificationPathID, callback) {
		sendID(this, 'AddServerCertificateAssignment', 'CertificationPathID', certificationPathID, callback);
	};

	/**
	 * Remove a certification path from the device's TLS server
	 * @param {string} certificationPathID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.removeServerCertificateAssignment = function(certificationPathID, callback) {
		sendID(this, 'RemoveServerCertificateAssignment', 'CertificationPathID', certificationPathID, callback);
	};

	/**
	 * Replace a certification path assigned to the device's TLS server in one step, so that it
	 * always has one, e.g. to renew its certificate
	 * @param {object} options
	 * @param {string} options.oldCertificationPathID
	 * @param {string} options.newCertificationPathID
	 * @param {Cam~AdvancedSecurityCallback} callback
	 */
	Cam.prototype.replaceServerCertificateAssignment = function(options, callback) {
		if (!options || !hasValue(options.oldCertificationPathID) || !hasValue(options.newCertificationPathID)) {
			return invalid(callback, 'replaceServerCertificateAssignment needs oldCertificationPathID and newCertificationPathID');
		}
		this._advancedSecurityRequest(
			'<ReplaceServerCertificateAssignment>' +
				element('OldCertificationPathID', options.oldCertificationPathID) +
				element('NewCertificationPathID', options.newCertificationPathID) +
				'</ReplaceServerCertificateAssignment>',
			() => null, callback);
	};
};
