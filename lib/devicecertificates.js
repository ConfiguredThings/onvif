/**
 * @namespace cam
 * @description Device service section for Cam class: certificates. These are the Device Management
 * service's certificate operations, from before the Advanced Security service. They manage the
 * device's HTTPS server certificates, the CA certificates it uses to check clients (and, on some
 * devices, servers it connects to) and whether it asks clients for a certificate. Devices without
 * the Advanced Security service (e.g. Axis) often have only these; devices with it may show the
 * same keystore through both, though a certificate's ID here can be its alias there.
 * See the Device Management section of https://www.onvif.org/specs/core/ONVIF-Core-Specification.pdf
 * @licence MIT
 */
module.exports = function(Cam) {

	const { linerase, escapeXml, toBase64DER, parseCertificate } = require('./utils');

	const DEVICE = 'http://www.onvif.org/ver10/device/wsdl';
	const SCHEMA = 'http://www.onvif.org/ver10/schema';

	function toArray(value) {
		if (value === undefined || value === null || value === '') {
			return [];
		}
		return Array.isArray(value) ? value : [value];
	}

	// linerase turns IDs that look like numbers into numbers
	function toStr(value) {
		if (value === undefined || value === null) {
			return undefined;
		}
		if (typeof value === 'object') {
			return value._ === undefined ? undefined : String(value._);
		}
		return String(value);
	}

	function hasValue(value) {
		return value !== undefined && value !== null && value !== '';
	}

	// An element in the device namespace, or nothing if there's no value
	function element(name, value) {
		return hasValue(value) ? `<${name}>${escapeXml(value)}</${name}>` : '';
	}

	// An element in the schema (tt) namespace, or nothing if there's no value
	function ttElement(name, value) {
		return hasValue(value) ? `<${name} xmlns="${SCHEMA}">${escapeXml(value)}</${name}>` : '';
	}

	// A tt:BinaryData element
	function binaryData(name, value) {
		return `<${name} xmlns="${SCHEMA}"><Data>${escapeXml(toBase64DER(value))}</Data></${name}>`;
	}

	function dateTime(value) {
		return value instanceof Date ? value.toISOString() : value;
	}

	function invalid(callback, message) {
		const err = new Error(message);
		if (typeof callback === 'function') {
			return callback(err, null);
		}
		throw err;
	}

	/**
	 * A certificate from the Device Management service
	 * @typedef {object} Cam~DeviceCertificate
	 * @property {string} certificateID
	 * @property {string} certificateContent The certificate, as base64 DER
	 * @property {object} [x509] The certificate's details, if it could be parsed, as for
	 * {@link Cam~X509Certificate}
	 */
	function certificate(c) {
		const content = toStr(c && c.certificate && c.certificate.data);
		return {
			certificateID: toStr(c.certificateID),
			certificateContent: content,
			x509: parseCertificate(content),
		};
	}

	/**
	 * Send a Device Management request
	 * @param {string} body The request, inside the SOAP body, without its namespace
	 * @param {function} parse Turns the linerased response into the result
	 * @param {function} callback
	 * @private
	 */
	Cam.prototype._deviceCertificateRequest = function(body, parse, callback) {
		this._request({
			// Without the address from GetServices or GetCapabilities, path (the device service) is used
			service: this.uri && this.uri.device ? 'device' : undefined,
			body: this._envelopeHeader() +
				body.replace(/^<(\w+)/, `<$1 xmlns="${DEVICE}"`) +
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
			if (callback) {
				callback.call(this, err, result, xml);
			}
		});
	};

	// Build a request body, calling back with an error if the arguments are bad
	function send(cam, build, parse, callback) {
		let body;
		try {
			body = build();
		} catch (e) {
			return invalid(callback, e.message);
		}
		cam._deviceCertificateRequest(body, parse, callback);
	}

	/**
	 * @callback Cam~DeviceCertificateCallback
	 * @property {?Error} error
	 * @property {*} result
	 * @property {string} xml Raw SOAP response
	 */

	/**
	 * Get the device's own certificates, e.g. for its HTTPS server
	 * @param {Cam~DeviceCertificateCallback} callback result is an Array of {@link Cam~DeviceCertificate}
	 */
	Cam.prototype.getCertificates = function(callback) {
		this._deviceCertificateRequest('<GetCertificates/>',
			(data) => toArray(data.getCertificatesResponse.nvtCertificate).map(certificate), callback);
	};

	/**
	 * Get the CA certificates the device trusts
	 * @param {Cam~DeviceCertificateCallback} callback result is an Array of {@link Cam~DeviceCertificate}
	 */
	Cam.prototype.getCACertificates = function(callback) {
		this._deviceCertificateRequest('<GetCACertificates/>',
			(data) => toArray(data.getCACertificatesResponse.CACertificate).map(certificate), callback);
	};

	/**
	 * Get which certificates are enabled. An enabled certificate of the device's own is the one its
	 * HTTPS server uses
	 * @param {Cam~DeviceCertificateCallback} callback result is an Array of {certificateID, status: boolean}
	 */
	Cam.prototype.getCertificatesStatus = function(callback) {
		this._deviceCertificateRequest('<GetCertificatesStatus/>',
			(data) => toArray(data.getCertificatesStatusResponse.certificateStatus).map((s) => ({
				certificateID: toStr(s.certificateID),
				status: s.status === true || s.status === 'true',
			})), callback);
	};

	/**
	 * Enable or disable certificates, e.g. to choose the one the device's HTTPS server uses
	 * @param {Array<{certificateID: string, status: boolean}>|{certificateID: string, status: boolean}} statuses
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.setCertificatesStatus = function(statuses, callback) {
		send(this, () => {
			const list = toArray(statuses);
			if (!list.length || list.some((s) => !s || !hasValue(s.certificateID) || typeof s.status !== 'boolean')) {
				throw new Error('setCertificatesStatus needs a certificateID and a boolean status for each certificate');
			}
			return '<SetCertificatesStatus>' + list.map((s) =>
				'<CertificateStatus>' + ttElement('CertificateID', s.certificateID) + ttElement('Status', s.status) +
					'</CertificateStatus>').join('') + '</SetCertificatesStatus>';
		}, () => null, callback);
	};

	/**
	 * Is the device's HTTPS server asking clients for a certificate (TLS client authentication)
	 * @param {Cam~DeviceCertificateCallback} callback result is a boolean
	 */
	Cam.prototype.getClientCertificateMode = function(callback) {
		this._deviceCertificateRequest('<GetClientCertificateMode/>',
			(data) => data.getClientCertificateModeResponse.enabled === true, callback);
	};

	/**
	 * Turn TLS client authentication on or off for the device's HTTPS server. Clients are checked
	 * against its CA certificates (see loadCACertificates)
	 * @param {boolean} enabled
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.setClientCertificateMode = function(enabled, callback) {
		if (typeof enabled !== 'boolean') {
			return invalid(callback, 'setClientCertificateMode needs a boolean');
		}
		this._deviceCertificateRequest(
			`<SetClientCertificateMode>${element('Enabled', enabled)}</SetClientCertificateMode>`,
			() => null, callback);
	};

	/**
	 * Have the device generate a key and a self-signed certificate for it
	 * @param {object} [options]
	 * @param {string} [options.certificateID] Chosen by the device if not given
	 * @param {string} [options.subject] e.g. `CN=cam1.example.com`
	 * @param {Date|string} [options.validNotBefore]
	 * @param {Date|string} [options.validNotAfter]
	 * @param {Cam~DeviceCertificateCallback} callback result is a {@link Cam~DeviceCertificate}
	 */
	Cam.prototype.createCertificate = function(options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}
		options = options || {};
		this._deviceCertificateRequest(
			'<CreateCertificate>' + element('CertificateID', options.certificateID) +
				element('Subject', options.subject) +
				element('ValidNotBefore', dateTime(options.validNotBefore)) +
				element('ValidNotAfter', dateTime(options.validNotAfter)) + '</CreateCertificate>',
			(data) => certificate(data.createCertificateResponse.nvtCertificate), callback);
	};

	/**
	 * Get a PKCS#10 certificate signing request for the key of one of the device's certificates
	 * (e.g. from createCertificate), for a CA to sign. Load the signed certificate with loadCertificates
	 * @param {object} options
	 * @param {string} options.certificateID
	 * @param {string} [options.subject] e.g. `CN=cam1.example.com`
	 * @param {Cam~DeviceCertificateCallback} callback result is the CSR, as base64 DER
	 */
	Cam.prototype.getPkcs10Request = function(options, callback) {
		if (!options || !hasValue(options.certificateID)) {
			return invalid(callback, 'getPkcs10Request needs certificateID');
		}
		this._deviceCertificateRequest(
			'<GetPkcs10Request>' + element('CertificateID', options.certificateID) +
				element('Subject', options.subject) + '</GetPkcs10Request>',
			(data) => toStr(data.getPkcs10RequestResponse.pkcs10Request.data), callback);
	};

	/**
	 * A certificate to load
	 * @typedef {object} Cam~CertificateToLoad
	 * @property {string} certificateID
	 * @property {string|Buffer} certificate PEM (one certificate), base64 DER or a DER Buffer
	 */
	function certificatesToLoad(operation, certificates, elementName) {
		const list = toArray(certificates);
		if (!list.length || list.some((c) => !c || !hasValue(c.certificateID) || !hasValue(c.certificate))) {
			throw new Error(`${operation} needs a certificateID and a certificate for each certificate`);
		}
		return list.map((c) => `<${elementName}>` + ttElement('CertificateID', c.certificateID) +
			binaryData('Certificate', c.certificate) + `</${elementName}>`).join('');
	}

	/**
	 * Load certificates for the device's own keys, e.g. one signed from getPkcs10Request
	 * @param {Array<Cam~CertificateToLoad>|Cam~CertificateToLoad} certificates
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.loadCertificates = function(certificates, callback) {
		send(this, () => '<LoadCertificates>' +
			certificatesToLoad('loadCertificates', certificates, 'NVTCertificate') + '</LoadCertificates>',
		() => null, callback);
	};

	/**
	 * Load CA certificates for the device to trust
	 * @param {Array<Cam~CertificateToLoad>|Cam~CertificateToLoad} certificates
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.loadCACertificates = function(certificates, callback) {
		send(this, () => '<LoadCACertificates>' +
			certificatesToLoad('loadCACertificates', certificates, 'CACertificate') + '</LoadCACertificates>',
		() => null, callback);
	};

	/**
	 * Load certificates with their private keys, made elsewhere
	 * @param {Array<{certificateID: string, certificate: (string|Buffer), privateKey: (string|Buffer)}>|object} certificates
	 * Each certificate and key is PEM, base64 DER or a DER Buffer. The certificateID is optional
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.loadCertificateWithPrivateKey = function(certificates, callback) {
		send(this, () => {
			const list = toArray(certificates);
			if (!list.length || list.some((c) => !c || !hasValue(c.certificate) || !hasValue(c.privateKey))) {
				throw new Error('loadCertificateWithPrivateKey needs a certificate and a privateKey for each certificate');
			}
			return '<LoadCertificateWithPrivateKey>' + list.map((c) =>
				'<CertificateWithPrivateKey>' + ttElement('CertificateID', c.certificateID) +
					binaryData('Certificate', c.certificate) + binaryData('PrivateKey', c.privateKey) +
					'</CertificateWithPrivateKey>').join('') + '</LoadCertificateWithPrivateKey>';
		}, () => null, callback);
	};

	/**
	 * Get the device's description of one of its certificates
	 * @param {string} certificateID
	 * @param {Cam~DeviceCertificateCallback} callback result is the linerased CertificateInformation:
	 * certificateID, issuerDN, subjectDN, keyUsage, extendedKeyUsage, keyLength, version, serialNum,
	 * signatureAlgorithm, validity
	 */
	Cam.prototype.getCertificateInformation = function(certificateID, callback) {
		if (!hasValue(certificateID)) {
			return invalid(callback, 'getCertificateInformation needs certificateID');
		}
		this._deviceCertificateRequest(
			`<GetCertificateInformation>${element('CertificateID', certificateID)}</GetCertificateInformation>`,
			(data) => {
				const info = data.getCertificateInformationResponse.certificateInformation;
				return { ...info, certificateID: toStr(info.certificateID) };
			}, callback);
	};

	/**
	 * Delete certificates, the device's own or CA certificates
	 * @param {Array<string>|string} certificateIDs
	 * @param {Cam~DeviceCertificateCallback} [callback]
	 */
	Cam.prototype.deleteCertificates = function(certificateIDs, callback) {
		const ids = toArray(certificateIDs).filter(hasValue);
		if (!ids.length) {
			return invalid(callback, 'deleteCertificates needs certificateIDs');
		}
		this._deviceCertificateRequest(
			'<DeleteCertificates>' + ids.map((id) => element('CertificateID', id)).join('') + '</DeleteCertificates>',
			() => null, callback);
	};
};
