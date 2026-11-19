const assert = require('assert');
const onvif = require('../lib/onvif');
const	serverMockup = require('../test/serverMockup');

describe('Events', () => {
	let cam = null;
	before((done) => {
		const options = {
			hostname: process.env.HOSTNAME || 'localhost',
			username: process.env.USERNAME || 'admin',
			password: process.env.PASSWORD || '9999',
			port: process.env.PORT ? parseInt(process.env.PORT) : 10101,
		};
		cam = new onvif.Cam(options, done);
	});
	it('should request device events', (done) => {
		cam.getEventProperties((err, res) => {
			assert.strictEqual(err, null);
			assert.deepStrictEqual(cam.events.properties, res);
			done();
		});
	});
	it('should request event service capabilities', (done) => {
		cam.getEventServiceCapabilities((err, res) => {
			assert.strictEqual(err, null);
			assert.ok([
				'PersistentNotificationStorage'
				, 'MaxPullPoints'
				, 'MaxNotificationProducers'
				, 'WSPausableSubscriptionManagerInterfaceSupport'
				, 'WSPullPointSupport'
				, 'WSSubscriptionPolicySupport'
			].every((name) => res[name] !== undefined));
			done();
		});
	});
	it('should throws an error in PullMessages method when no pull-point subscription exists', (done) => {
		assert.throws(() => {
			cam.pullMessages({});
		});
		cam.pullMessages({}, (err) => {
			assert.notEqual(err, null);
			done();
		});
	});
	it('should create PullPointSubscription', (done) => {
		cam.createPullPointSubscription((err, data) => {
			assert.strictEqual(err, null);
			assert.deepStrictEqual(data, cam.events.subscription);
			done();
		});
	});
	it('should get messages with PullMessage method', (done) => {
		cam.pullMessages({}, (err, data) => {
			assert.strictEqual(err, null);
			assert.ok(['currentTime', 'terminationTime'].every((name) => data[name] !== undefined));
			done();
		});
	});
	it('should create PullPoint subscription via `event` event and receive events from mockup server', (done) => {
		delete cam.events.terminationTime; // remove subscribtion if any
		let gotMessage = 0;
		const onEvent = () => gotMessage += 1;
		cam.on('event', onEvent);
		setTimeout(() => {
			assert.ok(cam.events.terminationTime !== undefined);
			assert.ok(gotMessage > 0);
			cam.removeListener('event', onEvent);
			done();
		}, 1000);
	});
	it('should stop pulling when nobody is listen to `event` event', (done) => {
		// wait 1 second for any Pull requests still running when we removed the listener to complete
		setTimeout(() => {
			assert.ok(cam.events.terminationTime === undefined);
			done();
		}, 1000);
	});
	it('should resume long-pulling when connection with server fails', (done) => {
		// wait 1 second for any Pull requests still running when we removed the listener to complete
		let gotMessage = 0;
		let pullMessagesCallCount = 0;
		const onEvent = () => {
			if (gotMessage === 10) {
				// after the tenth message, the next requests will reset the connection
				serverMockup.connectionBreaker.break = true;
			}
			gotMessage += 1;
		};
		const pullMessages = cam.pullMessages;
		cam.pullMessages = function(options, callback) {
			pullMessagesCallCount += 1;
			pullMessages.call(cam, options, callback);
		};
		cam.on('event', onEvent);
		setTimeout(() => {
			serverMockup.connectionBreaker.break = false;
			cam.pullMessages = pullMessages;
			assert.ok(gotMessage === 11 || gotMessage === 12);
			assert.ok(pullMessagesCallCount > gotMessage && pullMessagesCallCount > 20);
			cam.removeListener('event', onEvent);
			cam.unsubscribe(done);
		}, 1.5 * 1000);
	});
	it('should return an error when calling renew without subscription', (done) => {
		cam.renew({}, (err) => {
			assert.ok(err instanceof Error);
			done();
		});
	});
});

describe('Event brokers', () => {
	let cam = null;
	let bodies = [];
	before((done) => {
		const options = {
			hostname: process.env.HOSTNAME || 'localhost',
			username: process.env.USERNAME || 'admin',
			password: process.env.PASSWORD || '9999',
			port: process.env.PORT ? parseInt(process.env.PORT) : 10101,
		};
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

	describe('getEventBrokers', () => {
		it('should return every broker, without the password', (done) => {
			cam.getEventBrokers((err, brokers) => {
				assert.strictEqual(err, null);
				assert.deepStrictEqual(brokers, [
					{
						url: 'mqtts://broker.example.com:8883',
						topic: 'cameras/cam1',
						username: 'cam1',
						certificateID: '12',
						certPathValidationPolicyID: '3',
						publishFilter: 'tns1:RuleEngine//.',
						qos: 0,
						status: 'Connected',
					},
					{
						url: 'mqtt://10.0.0.5:1883',
						topic: '1234',
						status: 'Offline',
					},
				]);
				assert.strictEqual(lastBody(), '<GetEventBrokers xmlns="http://www.onvif.org/ver10/events/wsdl"></GetEventBrokers>');
				done();
			});
		});
		it('should ask for the broker with an address', (done) => {
			cam.getEventBrokers({url: 'mqtt://a&b:1883'}, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), '<GetEventBrokers xmlns="http://www.onvif.org/ver10/events/wsdl">' +
					'<Address>mqtt://a&amp;b:1883</Address></GetEventBrokers>');
				done();
			});
		});
		it('should work as a promise', async() => {
			const { Cam: CamPromise } = require('../promises/cam');
			const pcam = new CamPromise({
				hostname: process.env.HOSTNAME || 'localhost',
				username: 'admin',
				password: '9999',
				port: process.env.PORT ? parseInt(process.env.PORT) : 10101,
			});
			await pcam.connect();
			const brokers = await pcam.getEventBrokers();
			assert.strictEqual(brokers.length, 2);
		});
	});

	describe('addEventBroker', () => {
		it('should send only the address and topic when that is all it is given', (done) => {
			cam.addEventBroker({url: 'mqtt://10.0.0.5:1883', topic: 'cam1'}, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), '<AddEventBroker xmlns="http://www.onvif.org/ver10/events/wsdl"><EventBroker>' +
					'<Address>mqtt://10.0.0.5:1883</Address><TopicPrefix>cam1</TopicPrefix>' +
					'</EventBroker></AddEventBroker>');
				done();
			});
		});
		it('should send every option, escaped and in the schema\'s order', (done) => {
			cam.addEventBroker({
				url: 'mqtts://broker.example.com:8883',
				topic: 'cameras/cam1',
				username: 'cam1',
				password: 'p&ss<word>',
				certificateID: 'client-1',
				certPathValidationPolicyID: '3',
				publishFilter: 'tns1:RuleEngine//.',
				qos: 0,
				metadataFilter: '<wsnt:TopicExpression xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">x</wsnt:TopicExpression>',
			}, (err) => {
				assert.strictEqual(err, null);
				const topicExpression = '<TopicExpression xmlns="http://docs.oasis-open.org/wsn/b-2" ' +
					'xmlns:tns1="http://www.onvif.org/ver10/topics" ' +
					'Dialect="http://www.onvif.org/ver10/tev/topicExpression/ConcreteSet">tns1:RuleEngine//.</TopicExpression>';
				assert.strictEqual(lastBody(), '<AddEventBroker xmlns="http://www.onvif.org/ver10/events/wsdl"><EventBroker>' +
					'<Address>mqtts://broker.example.com:8883</Address>' +
					'<TopicPrefix>cameras/cam1</TopicPrefix>' +
					'<UserName>cam1</UserName>' +
					'<Password>p&amp;ss&lt;word&gt;</Password>' +
					'<CertificateID>client-1</CertificateID>' +
					'<PublishFilter>' + topicExpression + '</PublishFilter>' +
					'<QoS>0</QoS>' +
					'<CertPathValidationPolicyID>3</CertPathValidationPolicyID>' +
					'<MetadataFilter><wsnt:TopicExpression xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">x</wsnt:TopicExpression></MetadataFilter>' +
					'</EventBroker></AddEventBroker>');
				done();
			});
		});
		it('should send mqtts without a client certificate or validation policy', (done) => {
			cam.addEventBroker({url: 'mqtts://broker.example.com:8883', topic: 'cam1', username: 'u', password: 'p'}, (err) => {
				assert.strictEqual(err, null);
				assert.ok(!lastBody().includes('CertificateID'));
				assert.ok(!lastBody().includes('CertPathValidationPolicyID'));
				assert.ok(lastBody().includes('<UserName>u</UserName><Password>p</Password>'));
				done();
			});
		});
	});

	describe('deleteEventBroker', () => {
		it('should send the address, escaped', (done) => {
			cam.deleteEventBroker({url: 'mqtt://a&b:1883'}, (err) => {
				assert.strictEqual(err, null);
				assert.strictEqual(lastBody(), '<DeleteEventBroker xmlns="http://www.onvif.org/ver10/events/wsdl">' +
					'<Address>mqtt://a&amp;b:1883</Address></DeleteEventBroker>');
				done();
			});
		});
		it('should take a broker from getEventBrokers', (done) => {
			cam.getEventBrokers((err, brokers) => {
				assert.strictEqual(err, null);
				cam.deleteEventBroker(brokers[1], (err) => {
					assert.strictEqual(err, null);
					assert.strictEqual(lastBody(), '<DeleteEventBroker xmlns="http://www.onvif.org/ver10/events/wsdl">' +
						'<Address>mqtt://10.0.0.5:1883</Address></DeleteEventBroker>');
					done();
				});
			});
		});
		it('should give an error, without sending anything, if there is no url', (done) => {
			cam.deleteEventBroker({}, (err) => {
				assert.ok(err instanceof Error);
				assert.strictEqual(bodies.length, 0);
				done();
			});
		});
	});
});
