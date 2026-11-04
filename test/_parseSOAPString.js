const parseSOAPString = require('../lib/utils').parseSOAPString;
const assert = require('assert');

const fault = '<?xml version="1.0" encoding="UTF-8"?>' +
	'<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:ter="http://www.onvif.org/ver10/error">' +
	'<SOAP-ENV:Header></SOAP-ENV:Header>' +
	'<SOAP-ENV:Body><SOAP-ENV:Fault>' +
	'<SOAP-ENV:Code><SOAP-ENV:Value>SOAP-ENV:Sender</SOAP-ENV:Value>' +
	'<SOAP-ENV:Subcode><SOAP-ENV:Value>ter:InvalidArgVal</SOAP-ENV:Value></SOAP-ENV:Subcode></SOAP-ENV:Code>' +
	'<SOAP-ENV:Reason><SOAP-ENV:Text xml:lang="en">Parameters can not be set</SOAP-ENV:Text></SOAP-ENV:Reason>' +
	'<SOAP-ENV:Detail><SOAP-ENV:Text>Bad resolution</SOAP-ENV:Text></SOAP-ENV:Detail>' +
	'</SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>';

describe('parseSOAPString function', () => {
	it('should return a SOAP Fault sent with an HTTP error status', (done) => {
		parseSOAPString(fault, (err, data, xml, statusCode) => {
			assert.strictEqual(err.message, 'ONVIF SOAP Fault: Parameters can not be set: Bad resolution');
			assert.strictEqual(statusCode, 400);
			done();
		}, 400, 'Bad Request');
	});
	it('should return a SOAP Fault sent with HTTP 200', (done) => {
		parseSOAPString(fault, (err) => {
			assert.strictEqual(err.message, 'ONVIF SOAP Fault: Parameters can not be set: Bad resolution');
			done();
		}, 200, 'OK');
	});
	it('should return an HTTP error when there is no SOAP Fault', (done) => {
		parseSOAPString('<html><body>Unauthorized</body></html>', (err, data, xml, statusCode) => {
			assert.strictEqual(err.message, 'HTTP Error 401 Unauthorized');
			assert.strictEqual(data, null);
			assert.strictEqual(statusCode, 401);
			done();
		}, 401, 'Unauthorized');
	});
});
