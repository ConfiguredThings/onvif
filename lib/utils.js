/**
 * @namespace utils
 * @description Common utils module
 * @author Andrew D.Laptev <a.d.laptev@gmail.com>
 * @licence MIT
 */

const xml2js = require('xml2js'),
	numberRE = /^-?([1-9]\d*|0)(\.\d*)?$/,
	dateRE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z$/,
	prefixMatch = /(?!xmlns)^.*:/;

/**
 * Parse SOAP object to pretty JS-object
 * @param {object} xml
 * @returns {object}
 */
const linerase = function(xml) {
	if (Array.isArray(xml)) {
		if (xml.length > 1) {
			return xml.map(linerase);
		} else {
			xml = xml[0];
		}
	}
	if (typeof xml === 'object') {
		var obj = {};
		Object.keys(xml).forEach(function(key) {
			obj[key] = linerase(xml[key]);
		});
		return obj;
	} else {
		if (xml === 'true') { return true; }
		if (xml === 'false') { return false; }
		if (numberRE.test(xml)) { return parseFloat(xml); }
		if (dateRE.test(xml)) { return new Date(xml); }
		return xml;
	}
};

/**
 * @callback ParseSOAPStringCallback
 * @property {?Error} error
 * @property {object} SOAP response
 * @property {string} raw XML
 * @property {number} HTTP Status Code
 */

/**
 * Parse SOAP response
 * @param {string} xml
 * @param {ParseSOAPStringCallback} callback
 * @param {number} statusCode. This is passed in so it can be passed back out to the callback
 */
const parseSOAPString = function(xml, callback, statusCode, statusMessage) {
	/* Filter out xml name spaces */
	xml = xml.replace(/xmlns([^=]*?)=(".*?")/g, '');

	try {
		xml2js.parseString(
			xml, {
				tagNameProcessors: [function(str) {
					str = str.replace(prefixMatch, '');
					var secondLetter = str.charAt(1);
					if (secondLetter && secondLetter.toUpperCase() !== secondLetter) {
						return str.charAt(0).toLowerCase() + str.slice(1);
					} else {
						return str;
					}
				}]
			},
			function(err, result) {
				/** Changed by CT: check for a SOAP Fault first, as SOAP 1.2 sends it with an HTTP error status */
				const body = result && result['envelope'] && result['envelope']['body'];
				if (!err && body && body[0] && body[0]['fault']) {
					var fault = body[0]['fault'][0];
					var reason;
					try {
						if (fault.reason[0].text[0]._) {
							reason = fault.reason[0].text[0]._;
						}
					} catch (e) {
						reason = '';
					}
					if (!reason) {
						try {
							reason = JSON.stringify(linerase(fault.code[0]));
						} catch (e) {
							reason = '';
						}
					}
					var detail = '';
					try {
						detail = fault.detail[0].text[0];
						if (typeof detail == 'object') {
							detail = detail._ || '';
						}
					} catch (e) {
						detail = '';
					}

					// console.error('Fault:', reason, detail);
					callback(new Error('ONVIF SOAP Fault: ' + reason + (detail ? ': ' + detail : '')), body, xml, statusCode);
				} else if (statusCode != 200) {
					callback(new Error(`HTTP Error ${statusCode} ${statusMessage}`), null, xml, statusCode);
				} else if (!body) {
					callback(new Error('Wrong ONVIF SOAP response'), null, xml, statusCode);
				} else {
					callback(err, body, xml, statusCode);
				}
			}
		);
	} catch (err) {
		callback(err, '', xml, statusCode);
	}
};

const s4 = function() {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
};

/**
 * Generate GUID
 * @returns {string}
 */
const guid = function() {
	return (s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4());
};

/**
 * Escape a value for XML text or an attribute
 * @param {*} value
 * @returns {string}
 */
const escapeXml = function(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
};

const pemBlockRE = /-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/g;

/**
 * The base64 of a DER value (a certificate, key, CSR or PKCS#12 file) for a SOAP request. Takes
 * base64, a PEM string or Buffer holding one block (e.g. a certificate or private key), or a
 * Buffer of DER. Throws if PEM has more than one block, as each request takes one certificate
 * @param {string|Buffer} value
 * @returns {string}
 */
const toBase64DER = function(value) {
	if (Buffer.isBuffer(value) && !value.subarray(0, 32).toString('latin1').includes('-----BEGIN ')) {
		return value.toString('base64');
	}
	const text = String(value);
	const blocks = [...text.matchAll(pemBlockRE)];
	if (blocks.length > 1) {
		throw new Error(`Expected one PEM block, found ${blocks.length} (${blocks.map((b) => b[1]).join(', ')})`);
	}
	return (blocks.length ? blocks[0][2] : text).replace(/\s+/g, '');
};

/**
 * Details of a DER certificate (base64), or undefined if it can't be parsed
 * (crypto.X509Certificate needs Node 15.6 or later)
 * @param {string} content
 * @returns {object|undefined} subject, issuer, subjectAltName, serialNumber, validFrom, validTo (Dates),
 * fingerprint256, ca
 */
const parseCertificate = function(content) {
	const crypto = require('crypto');
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
};

module.exports = {
	linerase: linerase,
	parseSOAPString: parseSOAPString,
	guid: guid,
	escapeXml: escapeXml,
	toBase64DER: toBase64DER,
	parseCertificate: parseCertificate,
};