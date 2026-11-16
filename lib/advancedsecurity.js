/**
 * @namespace cam
 * @description Advanced Security service section for Cam class: reading the keystore
 * (keys, certificates, certification paths) and certification path validation policies.
 * See https://www.onvif.org/specs/srv/security/ONVIF-Security-Service-Spec.pdf
 * @licence MIT
 */
module.exports = function(Cam) {

	const crypto = require('crypto');
	const linerase = require('./utils').linerase;

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

	// Details of a DER certificate (base64), or undefined if it can't be parsed
	// (crypto.X509Certificate needs Node 15.6 or later)
	function parseCertificate(content) {
		if (!content || !crypto.X509Certificate) {
			return undefined;
		}
		try {
			const cert = new crypto.X509Certificate(Buffer.from(String(content), 'base64'));
			return {
				subject: cert.subject,
				issuer: cert.issuer,
				subjectAltName: cert.subjectAltName,
				serialNumber: cert.serialNumber,
				validFrom: new Date(cert.validFrom),
				validTo: new Date(cert.validTo),
				fingerprint256: cert.fingerprint256,
				ca: cert.ca,
			};
		} catch (e) {
			return undefined;
		}
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
			(data) => toArray(data.getAllCertPathValidationPoliciesResponse.certPathValidationPolicy).map((p) => ({
				...p,
				certPathValidationPolicyID: toStr(p.certPathValidationPolicyID),
				alias: toStr(p.alias),
				trustAnchor: toArray(p.trustAnchor).map((t) => ({ ...t, certificateID: toStr(t.certificateID) })),
			})), callback);
	};

	function escapeXml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
};
