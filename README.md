> [!IMPORTANT]
> This repo is a fork of https://github.com/agsh/onvif/tree/master with changes specific to the Cross Domain CCTV project.
>
> The upstream project has a focus of discovery and workarounds for various camera models whilst we value stability and the
> ability to quickly adapt to the specific cameras we need to support, hence the fork.
>    
> A new branch `main` was created from the upstream `master` branch at the point where it was forked.
> Whilst there are no plans to contribute back the changes this does provide a reference point for any rebase or contributions back to the origin.
> The CHANGELOG.md (not really maintained in the original) was updated at point we forked to be consistent with [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
>
> In the context of this project the onvif module is used to to communicate with the cameras for three specific use cases:
> - To generate the reference data required by the high side Onvif server, which in turn provides the ONVIF presentation to the NVRs
> - To generate the hash of the current configuration
> - To make PTZ calls 

# ONVIF

[![Coverage Status](https://img.shields.io/coveralls/agsh/onvif.svg)](https://coveralls.io/r/agsh/onvif?branch=master)
[![NPM version](https://img.shields.io/npm/v/onvif.svg)](https://www.npmjs.com/package/onvif)

ONVIF Client protocol Profile S (Live Streaming) and Profile G (Replay) Node.js implementation.

This is a wrapper to ONVIF protocol which allows you to get information about your NVT (network video transmitter)
device, its media sources, control PTZ (pan-tilt-zoom) movements and manage presets, detect devices in your network and control its events.
It will also allow you to get information about your NVR (network video recorder) Profile G device and obtain a list of recordings.

The library uses NodeJS. And works on the server-side.

[![ONVIF](https://www.onvif.org/wp-content/themes/onvif-public/images/logo.png)](http://onvif.org)

## Troubleshooting
The library is tested on a test bed with 5 x Axis, 2 x Bosch, 1 x Canon, 2 x Hanwha, 4 x HikVision, 1 x Panasonic, 2 x Sony and 2 x unknown vendor cameras. There is a mix of PTZ and Fixed cameras and a mix of Pre-Profile, Profile S, Profile G and Profile T devices.

It is also tested with some Analogue Encoders from Avigilon, Axis, Bosch and HikVision including testing the RS485 output.

We welcome any donations or long term loans cameras from other vendors to test compatibility especially when testing the Media2 API, ONVIF Events and OSD.


## Installation

### NPM

`npm install onvif` - install latest stable version

`npm install agsh/onvif` - install latest version from GitHub

`npm install agsh/onvif#v1` - install latest development version

### Clone the latest version from github
`git clone https://github.com/agsh/onvif.git`

### Tests
In the library directory run `npm test`

By default the tests use a mockup server to generate ONVIF replies.

The discovery tests are skipped, as they send a probe on the real network and any camera on it
will reply as well as the mockup server. To run them, on a network with no ONVIF devices, set
`TEST_DISCOVERY=1`.

To test with the real device, set appropriate environment variables `HOSTNAME`, `USERNAME`, `PASSWORD`, `PORT` and run
tests.

### Documentation
To build jsdoc for the library with default theme run `npm run jsdoc`. Otherwise use `jsdoc` with sources from
`./lib/*.js`

## Quick example

Special teasing example how to create little funny video server (http://localhost:6147) with 1 ffmpeg and 3 node.js libraries:
<video src="https://github.com/agsh/onvif/assets/576263/e816fed6-067a-4f77-b3f5-ccd9d5ff1310" width="300" />

```shell
sudo apt install ffmpeg
npm install onvif socket.io rtsp-ffmpeg
```

```js
const server = require('http').createServer((req, res) =>
        res.end(`
<!DOCTYPE html><body>
<canvas width='640' height='480' />
<script src="/socket.io/socket.io.js"></script><script>
  const socket = io(), ctx = document.getElementsByTagName('canvas')[0].getContext('2d');
  socket.on('data', (data) => {
    const img = new Image;    
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], {type: 'application/octet-binary'}));
    img.onload = () => {
      URL.revokeObjectURL(url, {type: 'application/octet-binary'});
      ctx.drawImage(img, 100, 100);
    };
    img.src = url;
  });
</script></body></html>`));
const { Cam } = require('onvif/promises'), io = require('socket.io')(server), rtsp = require('rtsp-ffmpeg');
server.listen(6147);

const cam = new Cam({username: 'username', password: 'password', hostname: '192.168.0.116', port: 2020});
(async() => {
  await cam.connect();
  const input = (await cam.getStreamUri({protocol:'RTSP'})).uri.replace('://', `://${cam.username}:${cam.password}@`);
  const stream = new rtsp.FFMpeg({input, resolution: '320x240', quality: 3});
  io.on('connection', (socket) => {
    const pipeStream = socket.emit.bind(socket, 'data');
    stream.on('disconnect', () => stream.removeListener('data', pipeStream)).on('data', pipeStream);
  });
  setInterval(() => cam.absoluteMove({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    zoom: Math.random()
  }), 3000);
})().catch(console.error);
```

## Other examples (located in the Examples Folder on the Github)
* [example.js](https://github.com/agsh/onvif/blob/master/examples/example.js) - Move camera to a pre-defined position then server the RTSP URL up via a HTTP Server. Click on the RTSP address in a browser to open the video (if you have the VLC plugin installed)
* [example2.js](https://github.com/agsh/onvif/blob/master/examples/example2.js) - takes an IP address range, scans the range for ONVIF devices (brute force scan) and displays information about each device found including make and model and RTSP URLs
For Profile S Cameras and Encoders it displays the default RTSP address
For Profile G Recorders it displays the RTSP address of the first recording
* [example3.js](https://github.com/agsh/onvif/blob/master/examples/example3.js) - reads the command line cursor keys and sends PTZ commands to the Camera
* [example4.js](https://github.com/agsh/onvif/blob/master/examples/example4.js) - uses Discovery to find cameras on the local network 
* [example5.js](https://github.com/agsh/onvif/blob/master/examples/example5.js) - connect to a camera via  SOCKS proxy. Note SSH includes a SOCKS proxy so you can use this example to connect to remote cameras via SSH
* [example6.js](https://github.com/agsh/onvif/blob/master/examples/example6.js) - ONVIF Events. Example can be switched btween using Pull Point Subscriptions and using Base Subscribe with a built in mini HTTP Server
* [example7.js](https://github.com/agsh/onvif/blob/master/examples/example7.js) - example using a Promise API. It uses 'promisify' to convert the ONVIF Library to return promises and uses Await to wait for responses
* [example8.js](https://github.com/agsh/onvif/blob/master/examples/example8.js) - example setting OSD On Screen Display. (also uses Promises API)

# API

## You can find this page and full API class documentation here: [https://onvif.pages.dev/](https://onvif.pages.dev/) ##

Short description of library possibilities is below.

## Discovery

Since 0.2.7 version library supports WS-Discovery of NVT devices. Currently it uses only `Probe` SOAP method that just works well.
You can find devices in your subnetwork using `probe` method of the Discovery singleton.
Discovery is an EventEmitter inheritor, so you can wait until discovery timeout, or subscribe on `device` event.
You must subscribe to the `error` event as a device on your network could reply with bad XML
Here some examples:

```js
var onvif = require('onvif');
onvif.Discovery.on('device', function(cam){
// function will be called as soon as NVT responds
	cam.username = <USERNAME>;
	cam.password = <PASSWORD>;
	cam.connect(console.log);
})
// Must have an error handler to catch bad replies from the network
onvif.Discovery.on('error', function (err,xml) {
  // function called as soon as NVT responds, but this library could not parse the response
  console.log('Discovery error ' + err);
});
onvif.Discovery.probe();
```

```js
var onvif = require('onvif');
// Must have an error handler to catch bad replies from the network
onvif.Discovery.on('error', function (err,xml) {
  console.log('Discovery error ' + err);
});
onvif.Discovery.probe(function(err, cams) {
// function will be called only after timeout (5 sec by default)
	if (err) { 
    // There is a device on the network returning bad discovery data
    // Probe results will be incomplete
    throw err;
  }
	cams.forEach(function(cam) {
		cam.username = <USERNAME>;
		cam.password = <PASSWORD>;
		cam.connect(console.log);
	});
});
```

In all of that cases you've got disconnected cameras. To access each camera (and issue ONVIF commands) you normally need
the tuple `username:password`. So, as shown in the examples, you can assign these properties and call `connect` method to
get full functionality.

### Discovery.probe(options, callback)
Options

- `timeout`, number. Time the probe method will wait NVT responses in ms
- `resolve`, boolean. If this argument is false, all discovered NVTs would be presented as data object instead of Cam instance

### Discovery events
- `device(cam, remoteInfo, responseXML)` fires on device discover. `cam` is a Cam instance, remoteInfo is an object with network information
 and responseXML is a body of SOAP response
- `error(error)` fires on some UDP error or on bad SOAP response from NVT

## Promises

Since version 0.7.2 this library have a `onvif/promises` namespace. It have promisified version of Cam constructor which returns an object with 
the same methods as described below or in documentation but returns promises instead of callback function. Short example of common 
usage is here:

```js
const onvif = require('onvif/promises');
onvif.Discovery.on('device', async (cam) => {
  // Set credentials to connect
  cam.username = 'username';
  cam.password = 'password';
  await cam.connect();
  cam.on('event', (event)=> console.log(JSON.stringify(event.message, null, '\t')));
  cam.on('eventsError', console.error);
  console.log(cam.username, cam.password);
  console.log((await cam.getStreamUri({protocol:'RTSP'})).uri);
  const date = await cam.getSystemDateAndTime();
  console.log(date);
  await cam.absoluteMove({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    zoom: Math.random()
  });
});
onvif.Discovery.on('error', console.error);
onvif.Discovery.probe();
```

## Cam class

```javascript
const Cam = require('onvif').Cam;
```

## new Cam(options, callback)

Options are:
- hostname
- username, password (optional, to deal with majority of functions)
- port (optional)

The library calls connect() automatically which executes the `getSystemDateAndTime`, `getCapabilities` and other methods.
Note on username and password:
- Some cameras do not require username:password credentials.
- If a camera does require a username:password but you do not provide them, you will be limited to executing a few ONVIF methods that can operate without credentials, for example you can execute only `getSystemDateAndTime` method.

Callback (optional) executes when the cam is initialised. Single argument for this function is possible error.

#### Technical description

When the cam object is created it automatically sends a `getCapabilities` command to the ONVIF device. If the device is a camera or encoder (NVT) it sends two commands to the ONVIF device:
`getVideoSources` and `getProfiles`. It fills corresponding properties of an object:

+ capabilities
  - device
  - events
  - imaging
  - media
  - PTZ
  - extension
+ uri (this is a links to different NVT services)
+ videoSources
  - $.token
  - framerate
  - resolution
+ profiles, array of profile object
  - name
  - videoSourceConfiguration
  - videoEncoderConfiguration
  - PTZConfiguration

After that it runs `getActiveSources` method. It iterates over all video sources and tries to find out proper configuration
for profile and videosource. First matching profile becomes a member of defaultProfiles array and video source configuration
with ptz configuration becomes a member of activeSources array.

Configuration for the first or the only one video source becomes defaultProfile and activeSource properties. All methods
without passing options object use it. You can change it manually at any time.

+ defaultProfile (link to the first profile in profiles)
+ activeSource (based on the default profile)
  - sourceToken
  - profileToken
  - encoding
  - width
  - height
  - fps
  - bitrate
  - ptz

### connect(callback)
Connect to the camera and fill device information properties with `getSystemDateAndTime`, `getCapabilities`, `getVideoSources`, `getProfiles` methods

See more detailed information at http://www.onvif.org/ver10/media/wsdl/media.wsdl
After cam initialisation we can run several ONVIF commands.
There are several common methods that work without credentials. Here are they: `getSystemDateAndTime`.

### getSystemDateAndTime(callback)
Returns a Date object with current camera datetime in the callback.
The ONVIF Standard says this would work without credentials (passed `username` and `password` arguments) so that the timeShift difference between the local clock and the NVT's onboard clock can be calculated for SOAP Authentication. However some devices claiming ONVIF support require a password and the library will re-try the connection if a username and password are available.

### getDeviceInformation(callback)
*Device.* Returns a device information, such as manufacturer, model and firmware version in the callback

### getServices(callback)
*Device.* Returns in callback and assigns to `#services` property an array consists of objects with properties: `namespace`, `XAddr`, `version`

### getServiceCapabilities(callback)
*Device.* Returns in callback and assigns to `#serviceCapabilities` property the capabilities of the device service (not media):
network, security and system. If your device supports some auxiliary capabilities they will be there too.

### getStreamUri(options, callback)
*Media.* Returns a URI that can be used to initiate a live media stream using RTSP as the control protocol
The options are:

- `stream` (optional) - defines if a multicast or unicast stream is requested. Possible values are: 'RTP-Unicast' (default), 'RTP-Multicast'
- `protocol` (optional) - defines the network protocol for streaming. Possible values are: 'UDP', 'TCP', 'RTSP' (default), 'HTTP'
- `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`

### getSnapshotUri(options, callback)
*Media.* Obtain a JPEG snapshot URI from the device.

### getPresets(options, callback)
Returns the saved presets as an a key-value object where the key is the name of a preset and a value is a preset token.
This method also stores the presets information in a `#presets` property of an object.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`

### gotoPreset(options, callback)
*PTZ.* Operation to go to a saved preset position for the PTZ node in the selected profile.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`
* `preset` - the name of preset. List of presets you can get by `#getPresets` method or in `#presets` property.

### setPreset(options, callback)
*PTZ.* Operation to set the current position as a preset for the PTZ node in the selected profile. If `presetToken` is passed as an option, then the preset for which that token is attached will be replaced. After success, you should re-fetch the presets with `#getPresets` method.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`
* `presetName` - the name to give to the preset. (optional) is this is a preset update.

### removePreset(options, callback)
*PTZ.* Operation to remove a preset specified by the preset token. After success, you should re-fetch the presets with `#getPresets` method.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`
* `presetToken` - the preset token to use for preset removal (this will be the `value` of a preset object found in `#presets` after calling the `#getPresets` method.

### gotoHomePosition(options, callback)
*PTZ.* Operation to go to the saved `home` position for the PTZ node in the selected profile. If no `home` position has been saved, the ONVIF camera will do nothing.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`
* `speed` An object with properties
  - `x` Pan speed, float within 0 to 1
  - `y` Tilt speed, float within 0 to 1
  - `zoom` Zoom speed, float within 0 to 1

  If the speed option is omitted, the default speed set by the PTZConfiguration will be used.

### setHomePosition(options, callback)
*PTZ.* Operation to set the current position as the `home` position for the PTZ node in the selected profile.

The options are:

* `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`

### getNodes(callback)
*PTZ.* Returns the properties of the current PTZ node, if it exists.
Use this function to get maximum number of presets, ranges of admitted values for x, y, zoom, iris, focus.
Sets all information into `#nodes` property.

### relativeMove(options, callback)
*PTZ.* This is a relative pan-tilt-zoom method. Options for this method is a delta between desired and current position of the camera.

The options are:

- `x` Pan, number or a string within -1 to 1, optional
- `y` Tilt, number or a string within -1 to 1, optional
- `zoom` Zoom, number or a string within 0 to 1, optional
- `speed` An object with properties
  * `x` Pan speed, float within 0 to 1
  * `y` Tilt speed, float within 0 to 1
  * `zoom` Zoom speed, float within 0 to 1

  If the speed option is omitted, the default speed set by the PTZConfiguration will be used.

Callback is optional and means essentially nothing

### absoluteMove(options, callback)
*PTZ.* This is an absolute pan-tilt-zoom method. Options for this method is an absolute position of the camera.

The options are:

- `x` Pan, number or a string within -1 to 1, optional
- `y` Tilt, number or a string within -1 to 1, optional
- `zoom` Zoom, number or a string within 0 to 1, optional
- `speed` An object with properties
  * `x` Pan speed, float within 0 to 1
  * `y` Tilt speed, float within 0 to 1
  * `zoom` Zoom speed, float within 0 to 1

  If the speed option is omitted, the default speed set by the PTZConfiguration will be used.

Callback is optional and means essentially nothing

### continuousMove(options, callback)
*PTZ.* Operation for continuous Pan/Tilt and Zoom movements

The options are:

- `x` Pan velocity, number or a string within -1 to 1, optional
- `y` Tilt velocity, number or a string within -1 to 1, optional
- `zoom` Zoom velocity, number or a string within -1 to 1, optional
- `timeout` Timeout in milliseconds, number. If timeout is omitted, movement will continue until `stop` command

### stop(options, callback)
*PTZ.* Stop ongoing pan, tilt and zoom movements of absolute, relative and continuous type

Options and callback are optional. The options properties are:

- `profileToken` (optional) - defines media profile to use and will define the configuration of the content of the stream. Default is `#activeSource.profileToken`
- `panTilt` (optional) - set true when we want to stop ongoing pan and tilt movements. If `panTilt` arguments are not present, this command stops these movements.
- `zoom` (optional) - set true when we want to stop ongoing zoom movement. If `zoom` arguments are not present, this command stops ongoing zoom movement.

### getStatus(options, callback)
*PTZ.* Returns an object with the current PTZ values.
```js
{
	position: {
		x: 'pan position', 
        y: 'tilt position',
		zoom: 'zoom'
	}
	, moveStatus: {} // camera moving
	, utcTime: 'current camera datetime'
}
```

### getConfigurations(callback)
*PTZ.* Get all the existing PTZConfigurations from the device. Configurations saved into `#configurations` property

### getConfigurationOptions(configurationToken, callback)
*PTZ.* Get supported coordinate systems including their range limitations for selected configuration. Extends corresponding
configuration object

### GetRecordings(callback)
*Recordings.* Get all the recordings tracks available on the device. Note: Only [Onvif Profile G](https://www.onvif.org/profiles/profile-g/) devices provide this features.

### GetReplayUri(callback)
*Recordings.* Get the replay stream or streams (if using a NVR) - usually RTSP - for the provided recording token/s.

### GetRecordingOptions(callback)
*Recordings.* Get the information of a recording token. Needed in order to match a recordingToken with a sourceToken. Used with both **GetRecordings** and **GetReplayUri** will allow to retreive recordings from an [Onvif Profile G](https://www.onvif.org/profiles/profile-g/) device. Note: not all devices are 100% Onvif G compliant.

### Advanced Security

*Advanced Security.* Read and change the device's keystore: its keys, its certificates (including any loaded manually, e.g. through the
camera's web page) and its certification path validation policies, and choose the certificates its TLS (HTTPS) server uses.
For devices without this service, see [Device certificates](#device-certificates). The IDs these return are what the event service's
`AddEventBroker` takes as `CertificateID` (the client certificate the device presents to an MQTT broker) and
`CertPathValidationPolicyID` (which CAs it trusts for the broker's certificate).

The service isn't in GetCapabilities, so its address comes from GetServices, which is called first if it hasn't been
already. If the device doesn't have the service, each call returns the error
`The device does not support the Advanced Security service`. IDs and aliases are always strings, and lists are always arrays.

#### hasAdvancedSecurity(callback)
Returns `true` if the device has the Advanced Security service.

#### getAdvancedSecurityCapabilities(callback)
The service's capabilities, e.g. `keystoreCapabilities.$.RSAKeyPairGeneration` and
`keystoreCapabilities.$.PKCS10ExternalCertificationWithRSA` say if the device can generate a key and a certificate signing request for it.

#### getAllCertificates(callback)
An array of every certificate in the keystore, each with `certificateID`, `keyID`, `alias`, `certificateContent`
(base64 DER), `hasPrivateKey` (if the device reports it) and `x509`, the certificate's details if it could be parsed (Node 15.6 or later):
`subject`, `issuer`, `subjectAltName`, `serialNumber`, `validFrom`, `validTo`, `fingerprint256` and `ca`. E.g. to find a camera's client certificate:
```js
const certs = await cam.getAllCertificates();
const client = certs.find((c) => c.x509 && c.x509.subject === 'CN=cam1.local');
```

#### getCertificate(certificateID, callback)
One certificate, as above.

#### getAllKeys(callback)
An array of the keys in the keystore: `keyID`, `alias`, `hasPrivateKey`, `keyStatus` (`ok`, `generating` or `corrupt`),
`externallyGenerated`, `securelyStored`.

#### getAllCertificationPaths(callback)
An array of the IDs of the certification paths (chains of certificates) in the keystore.

#### getCertificationPath(certificationPathID, callback)
A certification path: `certificateID`, an array of certificate IDs from the certificate to its CA, and `alias`.

#### getAllCertPathValidationPolicies(callback)
An array of the certification path validation policies: `certPathValidationPolicyID`, `alias`, `parameters` and
`trustAnchor`, an array of `{certificateID}`, the CAs the policy trusts.

#### getCertPathValidationPolicy(certPathValidationPolicyID, callback)
One policy, as above.

#### Changing the keystore

Each of these checks its arguments and returns an error, without sending anything, if one it needs is missing.
A certificate, key or PKCS#12 file can be given as PEM (one block), base64 DER or a Buffer.

- `createRSAKeyPair({keyLength, alias})` / `createECCKeyPair({ellipticCurve, alias})`: the device generates a key pair
  and returns `{keyID, estimatedCreationTime}`. The key is generated in the background, so wait for
  `getKeyStatus(keyID)` to return `ok` before using it
- `getKeyStatus(keyID)`: `ok`, `generating` or `corrupt`. `deleteKey(keyID)` deletes a key no certificate uses
- `createPKCS10CSR({keyID, subject, signatureAlgorithm})`: a certificate signing request for a CA to sign, as base64 DER.
  `subject` is `{country, stateOrProvinceName, locality, organization, organizationalUnit, commonName}`, each a string
  or an array. `signatureAlgorithm` is `sha256WithRSAEncryption` (the default), `sha384WithRSAEncryption`,
  `sha512WithRSAEncryption`, `ecdsa-with-SHA256`, `ecdsa-with-SHA384`, `ecdsa-with-SHA512` or an OID; an ECC key needs an `ecdsa` one
- `createSelfSignedCertificate({keyID, subject, alias, notValidBefore, notValidAfter, signatureAlgorithm})`: returns the certificate's ID
- `uploadCertificate({certificate, alias, keyAlias, privateKeyRequired})`: a CA's certificate, or one signed from a CSR.
  Returns `{certificateID, keyID}`
- `uploadCertificateWithPrivateKeyInPKCS12({pkcs12, passphrase, certificationPathAlias, keyAlias, ignoreAdditionalCertificates})`:
  a certificate with its key (and its CA certificates) made elsewhere. Returns `{certificationPathID, keyID}`
- `deleteCertificate(certificateID)`
- `createCertificationPath({certificateIDs, alias})`: a chain, from the device's certificate to its root CA. Returns its ID.
  `deleteCertificationPath(certificationPathID)`
- `createCertPathValidationPolicy({trustAnchors, alias, requireTLSWWWClientAuthExtendedKeyUsage, useDeltaCRLs})`: which CA
  certificates to trust. Returns its ID. `deleteCertPathValidationPolicy(certPathValidationPolicyID)`

E.g. to have a camera check an MQTT broker's certificate:
```js
const { certificateID } = await cam.uploadCertificate({ certificate: fs.readFileSync('broker-ca.pem'), alias: 'mqtt-ca' });
const policyID = await cam.createCertPathValidationPolicy({ trustAnchors: [certificateID], alias: 'mqtt-broker' });
await cam.addEventBroker({ url: 'mqtts://broker.example.com:8883', topic: 'cam1', certPathValidationPolicyID: policyID });
```

And to give it a client certificate whose private key never leaves the camera:
```js
const { keyID } = await cam.createRSAKeyPair({ keyLength: 2048 });
while (await cam.getKeyStatus(keyID) === 'generating') {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const csr = await cam.createPKCS10CSR({ keyID, subject: { commonName: 'cam1.example.com' } });
// ... have the CA sign the CSR, then
const { certificateID } = await cam.uploadCertificate({ certificate: signedPEM });
await cam.createCertificationPath({ certificateIDs: [certificateID] });
```

#### The TLS server's certificates
- `getAssignedServerCertificates()`: the IDs of the certification paths the device's TLS server uses
- `addServerCertificateAssignment(certificationPathID)` / `removeServerCertificateAssignment(certificationPathID)`
- `replaceServerCertificateAssignment({oldCertificationPathID, newCertificationPathID})`: in one step, e.g. to renew a
  certificate, so the server always has one

### Device certificates

*Device.* The Device Management service's certificate operations, from before the Advanced Security service. They manage
the certificates the device's HTTPS server uses, the CA certificates it trusts, and whether it asks clients for a
certificate. Devices without the Advanced Security service (e.g. Axis) often have only these. A device with both may show
the same keystore through each, but a certificate's ID here can be its alias there.

Each certificate is `{certificateID, certificateContent, x509}`, as for `getAllCertificates()`. IDs are returned exactly
as the device sends them, so keep any spaces. A certificate or key to load can be PEM (one block), base64 DER or a Buffer.
Note the names: `getCertificates()` and `deleteCertificates()` are these, while `getCertificate()` and
`deleteCertificate()` are Advanced Security's.

- `getCertificates()`: the device's own certificates. `getCACertificates()`: the CA certificates it trusts
- `getCertificatesStatus()`: `[{certificateID, status}]`; an enabled certificate of the device's own is the one its HTTPS server uses.
  `setCertificatesStatus([{certificateID, status}])` changes them
- `getClientCertificateMode()` / `setClientCertificateMode(enabled)`: whether the HTTPS server asks clients for a certificate,
  checked against the CA certificates
- `createCertificate({certificateID, subject, validNotBefore, validNotAfter})`: the device generates a key and a self-signed
  certificate for it, and returns the certificate. Every option is optional, e.g. `subject: 'CN=cam1.example.com'`
- `getPkcs10Request({certificateID, subject})`: a certificate signing request for that certificate's key, as base64 DER.
  `loadCertificates([{certificateID, certificate}])` loads the signed certificate
- `loadCACertificates([{certificateID, certificate}])`: CA certificates for the device to trust
- `loadCertificateWithPrivateKey([{certificateID, certificate, privateKey}])`: a certificate and key made elsewhere. The ID is optional
- `getCertificateInformation(certificateID)`: the device's description of a certificate: `subjectDN`, `issuerDN`, `keyLength`, `validity`, ...
- `deleteCertificates([certificateID, ...])`

E.g. to give a camera a CA-signed HTTPS certificate:
```js
await cam.createCertificate({ certificateID: 'https-1', subject: 'CN=cam1.example.com' });
const csr = await cam.getPkcs10Request({ certificateID: 'https-1' });
// ... have the CA sign the CSR, then
await cam.loadCertificates([{ certificateID: 'https-1', certificate: signedPEM }]);
await cam.setCertificatesStatus([{ certificateID: 'https-1', status: true }]);
```

### MQTT event brokers

*Events.* The device can publish its events to MQTT brokers. Which protocols it supports (`mqtt`, `mqtts`, `ws`, `wss`)
and how many brokers it can have are in `getEventServiceCapabilities()`'s `EventBrokerProtocols` and `MaxEventBrokers`.

A broker is an object with:
- `url`: the broker's address, `scheme://host:port[/resource]` (the resource is only for websockets). It must be unique on the device
- `topic`: the prefix for every topic the device publishes. It must not be empty
- `username` and `password` (optional): each is sent only if it is given
- `certificateID` (optional, for `mqtts` / `wss`): the client certificate the device presents to the broker, from `getAllCertificates()`
- `certPathValidationPolicyID` (optional, for `mqtts` / `wss`): the policy, from `getAllCertPathValidationPolicies()`,
  whose CAs the device trusts for the broker's certificate. Without one, the device doesn't check the broker's certificate
- `publishFilter` and `metadataFilter` (optional): a concrete topic expression for the event or metadata topics to publish,
  e.g. `'tns1:RuleEngine//.|tns1:VideoSource//.'`. A string starting with `<` is sent as the filter's XML instead
- `qos` (optional): 0, 1 or 2
- `status`: only returned by `getEventBrokers()`, e.g. `Offline`, `Connecting` or `Connected`

#### addEventBroker(broker, callback)
Adds a broker. All its values are XML-escaped.

#### getEventBrokers([options], callback)
An array of the device's brokers, or with `options.url` only the broker with that address. They have the same names
`addEventBroker()` takes, so one can be read, changed and added again, but never the password, which the device doesn't return.
```js
const brokers = await cam.getEventBrokers();
const connected = brokers.filter((b) => b.status === 'Connected');
```

#### deleteEventBroker(options, callback)
Deletes the broker with the address `options.url`, so a broker from `getEventBrokers()` can be passed as it is. As the
address must be unique on the device, this is how a broker is changed: delete it, then add it again.
```js
const [old] = await cam.getEventBrokers({url: 'mqtts://broker.example.com:8883'});
await cam.deleteEventBroker(old);
await cam.addEventBroker({...old, topic: 'cameras/cam2', password: 'secret'});
```

## Changelog
- 0.8.0 Only Digest Auth support
- 0.7.1 Improved events handling
- 0.6.5 Add MEDIA2 support, Profile T and GetServices XAddrs support for H265 cameras. Add support for HTTPS. Add Discovery.on('error') to examples. Add flag to only send Zoom, or only send Pan/Tilt for some broken cameras (Sony XP1 Xiongmai). Fix bug in GetServices. Improve setNTP command. API changed on getNetworkInterfaces and other methods that could return an Array or a Single Item. We now return an Array in all cases. Add example converting library so it uses Promises with Promisify. Enable 3702 Discovery on Windows for MockServer. Add MockServer test cases)
- 0.6.1 Workaround for cams that don't send date-time
- 0.6.0 Refactor modules for proper import in electron-based environment
- 0.5.5 Added ptz.`gotoHomePosition`, ptz.`setHomePosition`. Fixed exceptions in ptz.`getConfigurations` and utils.`parseSOAPString`. Added tests for ptz.`setPreset`, ptz.`removePreset`, ptz.`gotoHomePosition`, and ptz.`setHomePosition`.
- 0.5.4 Bumped for NPM.
- 0.5.3 Some fixes. Tests
- 0.5.2 `preserveAddress` property for NAT devices, discovery with multiple network interfaces (@Climax777)
- 0.5.1 Critical bugfix in SOAP-auth for some cams
- 0.5.0 Profile G support (@RogerHardiman), proper SOAP auth, nodejs support >= 0.12
- 0.4.2 Bugfixes
- 0.4.1 Improved discovery (@sousandrei, @RogerHardiman)
- 0.4.0 Encoder support (@chriswiggins), Imaging service (@EastL)
- 0.3.1 EventEmitter-based events
- 0.3.0 Refactoring, documentation, event service basics
- 0.2.7 WS-Discovery

## Links
WSDL schemes and docs:
- [Operations index](http://www.onvif.org/onvif/ver20/util/operationIndex.html)
- http://www.onvif.org/onvif/ver10/tc/onvif_core_ver10.pdf
- http://www.onvif.org/ver10/device/wsdl/devicemgmt.wsdl
- http://www.onvif.org/ver10/media/wsdl/media.wsdl
- http://www.onvif.org/ver20/ptz/wsdl/ptz.wsdl
- http://www.onvif.org/onvif/ver10/recording.wsdl
- http://www.onvif.org/onvif/ver10/replay.wsdl
- [ONVIF Application Programmer's Guide](http://www.onvif.org/Portals/0/documents/WhitePapers/ONVIF_WG-APG-Application_Programmer's_Guide.pdf)
